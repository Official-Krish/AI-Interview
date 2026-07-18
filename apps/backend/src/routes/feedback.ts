import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { withIdempotency } from "../middleware/idempotency";

export const feedbackRoutes = new Elysia({ prefix: "/feedback" }).guard(
  {},
  (app) =>
    app
      .use(authGuard)
      .post(
        "/submit",
        withIdempotency(async ({ user, body }: any) => {
          return container.feedback.submit(
            user.id,
            user.email,
            user.name ?? null,
            body,
          );
        }),
        {
          body: t.Object({
            subject: t.String({ minLength: 1 }),
            rating: t.Integer({ minimum: 1, maximum: 5 }),
            category: t.Optional(t.String()),
            message: t.String({ minLength: 1 }),
          }),
        },
      )
      .get("/", async ({ user }) => {
        return container.feedback.list(user.id, user.role);
      }),
);
