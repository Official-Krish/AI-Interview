import { Elysia } from "elysia";
import { jwt } from "@elysia/jwt";
import type { Cookie } from "elysia";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../lib/tokens";

const SECRET = Bun.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const TTL = 30_000;

type CacheEntry = {
  role: "FREE" | "PRO" | "ADMIN";
  expiresAt: number;
};

const roleCache = new Map<string, CacheEntry>();

export const authGuard = new Elysia({ name: "auth-guard" })
  .use(jwt({ secret: SECRET, exp: "7d" }))
  .resolve({ as: "scoped" }, async ({ jwt, cookie, request, set }) => {
    let payload: Awaited<ReturnType<typeof verifyAccessToken>> = null;

    // Try access_token cookie first (new dual-token system)
    const accessCookie = cookie.access_token as Cookie<unknown> | undefined;
    if (accessCookie?.value && typeof accessCookie.value === "string") {
      payload = await verifyAccessToken(accessCookie.value);
    }

    // Fallback: try legacy token cookie (backward compat)
    if (!payload) {
      const t = cookie.token as Cookie<unknown> | undefined;
      const tokenValue = t?.value;
      if (typeof tokenValue === "string") {
        const legacyPayload = await jwt.verify(tokenValue);
        if (legacyPayload && legacyPayload.id && legacyPayload.email) {
          payload = {
            id: legacyPayload.id as string,
            email: legacyPayload.email as string,
            name: legacyPayload.name as string | undefined,
            role: (legacyPayload.role as "FREE" | "PRO" | "ADMIN") ?? "FREE",
            roleVersion: (legacyPayload.roleVersion as number) ?? 0,
          };
        }
      }
    }

    if (!payload) {
      set.status = 401;
      throw new Error("Unauthorized");
    }

    const uid = payload.id;

    const cached = roleCache.get(uid);
    if (
      cached !== null &&
      cached !== undefined &&
      Date.now() < cached.expiresAt
    ) {
      return {
        user: {
          id: uid,
          email: payload.email,
          name: payload.name,
          role: cached.role,
        },
      };
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: uid },
        select: { roleVersion: true, role: true },
      });

      if (!user || user.roleVersion !== payload.roleVersion) {
        set.status = 401;
        throw new Error("Unauthorized");
      }

      roleCache.set(uid, { role: user.role, expiresAt: Date.now() + TTL });

      return {
        user: {
          id: uid,
          email: payload.email,
          name: payload.name,
          role: user.role,
        },
      };
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") throw err;
      set.status = 401;
      throw new Error("Unauthorized");
    }
  });
