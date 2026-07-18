import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { withIdempotency } from "../middleware/idempotency";

export const turnRoutes = new Elysia().guard({}, (app) =>
  app
    .use(authGuard)
    .post(
      "/interview/:id/turns",
      withIdempotency(async ({ params: { id }, user, body }: any) => {
        return container.turn.create(user.id, id, body);
      }),
      {
        body: t.Object({
          questionText: t.String(),
          answerText: t.Optional(t.String()),
          questionStartMs: t.Optional(t.Nullable(t.Number())),
          answerStartMs: t.Optional(t.Nullable(t.Number())),
          answerEndMs: t.Optional(t.Nullable(t.Number())),
          score: t.Optional(t.Nullable(t.Number())),
          feedback: t.Optional(t.Nullable(t.String())),
        }),
      },
    )
    .get("/interview/:id/turns", async ({ params: { id }, user, query }) => {
      return container.turn.list(
        user.id,
        id,
        Number(query.take) || 50,
        query.cursor,
      );
    })
    .get(
      "/interview/:id/turns/:turnId",
      async ({ params: { id, turnId }, user }) => {
        return container.turn.getById(user.id, id, turnId);
      },
    )
    .patch(
      "/interview/:id/turns/:turnId",
      async ({ params: { id, turnId }, user, body }: any) => {
        return container.turn.update(user.id, id, turnId, body);
      },
      {
        body: t.Object({
          answerText: t.Optional(t.String()),
          answerStartMs: t.Optional(t.Nullable(t.Number())),
          answerEndMs: t.Optional(t.Nullable(t.Number())),
          score: t.Optional(t.Nullable(t.Number())),
          feedback: t.Optional(t.Nullable(t.String())),
        }),
      },
    ),
);
