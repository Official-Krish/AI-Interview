import { Elysia, t } from "elysia";
import { jwt } from "@elysia/jwt";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { strictRateLimit, authRateLimit } from "../middleware/rateLimit";
import { AppError } from "../lib/errors";
import {
  verifyRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
} from "../lib/tokens";
import { cached } from "../lib/cacheMiddleware";
import { withIdempotency } from "../middleware/idempotency";
import { container } from "../lib/container";

const SECRET = Bun.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

function setTokenCookies(
  cookie: Record<string, unknown>,
  accessToken: string,
  refreshToken?: string,
) {
  const set = (name: string, value: string, opts: Record<string, unknown>) => {
    const c = cookie[name] as
      | { set: (o: Record<string, unknown>) => void }
      | undefined;
    c?.set(opts);
  };

  set("access_token", accessToken, {
    value: accessToken,
    httpOnly: true,
    secure: true,
    maxAge: 15 * 60,
    path: "/",
    sameSite: "lax",
  });

  if (refreshToken) {
    set("refresh_token", refreshToken, {
      value: refreshToken,
      httpOnly: true,
      secure: true,
      maxAge: 7 * 86400,
      path: "/api/auth/refresh",
      sameSite: "strict",
    });
  }
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwt({ secret: SECRET, exp: "15m" }))
  .guard({}, (g) =>
    g.use(strictRateLimit).post(
      "/signup",
      withIdempotency(async ({ body }: any) => {
        return await container.auth.signup(
          body.email,
          body.password,
          body.name,
        );
      }),
      {
        body: t.Object({
          email: t.String({ format: "email" }),
          password: t.String({ minLength: 8 }),
          name: t.Optional(t.String()),
        }),
      },
    ),
  )
  .guard({}, (g) =>
    g
      .use(authRateLimit)
      .post(
        "/verify-otp",
        async ({ body, cookie }: any) => {
          const result = (await container.auth.verifyOtp(
            body.email,
            body.otp,
          )) as any;
          if ("accessToken" in result) {
            setTokenCookies(cookie, result.accessToken, result.refreshToken);
          }
          return result;
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
            otp: t.String({ length: 6 }),
          }),
        },
      )
      .post(
        "/resend-otp",
        async ({ body }: any) => {
          return await container.auth.resendOtp(body.email);
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
          }),
        },
      )
      .post(
        "/login",
        async ({ body, cookie, set }: any) => {
          try {
            const result = await container.auth.login(
              body.email,
              body.password,
            );
            setTokenCookies(cookie, result.accessToken, result.refreshToken);
            return { user: result.user };
          } catch (e: unknown) {
            if (e instanceof AppError && e.code === "EMAIL_NOT_VERIFIED") {
              set.status = 403;
              return {
                error: e.message,
                needsVerification: true,
                email: (e.details as { email: string })?.email,
              };
            }
            throw e;
          }
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
            password: t.String(),
          }),
        },
      )
      .post(
        "/forgot-password",
        async ({ body }: any) => {
          return await container.auth.forgotPassword(body.email);
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
          }),
        },
      )
      .post(
        "/reset-password",
        async ({ body }: any) => {
          return await container.auth.resetPassword(
            body.email,
            body.otp,
            body.password,
          );
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
            otp: t.String({ length: 6 }),
            password: t.String({ minLength: 8 }),
          }),
        },
      ),
  )
  .post("/refresh", async ({ cookie, set }) => {
    const refreshCookie = cookie.refresh_token as
      | { value?: string }
      | undefined;
    const token = refreshCookie?.value;
    if (!token) {
      cookie.access_token?.remove();
      set.status = 401;
      return { error: "No refresh token", code: "NO_REFRESH_TOKEN" };
    }

    const result = await rotateRefreshToken(token);
    if (!result) {
      cookie.access_token?.remove();
      cookie.refresh_token?.remove();
      set.status = 401;
      return {
        error: "Invalid or expired refresh token",
        code: "INVALID_REFRESH_TOKEN",
      };
    }

    setTokenCookies(cookie, result.accessToken, result.refreshToken);

    return { success: true };
  })
  .post("/revoke-all", async ({ cookie, set }) => {
    const refreshCookie = cookie.refresh_token as
      | { value?: string }
      | undefined;
    const token = refreshCookie?.value;
    if (token) {
      const payload = await verifyRefreshToken(token);
      if (payload) {
        await revokeAllUserTokens(payload.id);
      }
    }
    cookie.access_token?.remove();
    cookie.refresh_token?.remove();
    return { success: true };
  })
  .post("/logout", async ({ cookie }) => {
    const refreshCookie = cookie.refresh_token as
      | { value?: string }
      | undefined;
    if (refreshCookie?.value) {
      const payload = await verifyRefreshToken(refreshCookie.value);
      if (payload) {
        await revokeAllUserTokens(payload.id);
      }
    }
    cookie.access_token?.remove();
    cookie.refresh_token?.remove();
    cookie.token?.remove();
    return { success: true };
  })
  .guard({}, (app) =>
    app.use(authGuard).get(
      "/me",
      cached(
        30,
        async ({ user, set }: any) => {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              emailVerified: true,
            },
          });
          if (!dbUser) {
            set.status = 404;
            return { error: "User not found" };
          }
          return { user: dbUser };
        },
        ({ user }: any) => `me:${user.id}`,
      ),
    ),
  )
  .guard({}, (app) =>
    app.use(authGuard).post("/ws-token", async ({ jwt, user }) => {
      return await container.auth.issueWsToken(jwt, user);
    }),
  );
