import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { withIdempotency } from "../middleware/idempotency";

export const dsaRoutes = new Elysia({ prefix: "/dsa" })
  .use(authGuard)
  .guard({}, (app) =>
    app
      .post(
        "/start",
        withIdempotency(async ({ user, body }: any) => {
          return container.dsa.startSession(
            user.id,
            body.interviewId,
            body.questionCount,
            body.language,
          );
        }),
        {
          body: t.Object({
            interviewId: t.String(),
            questionCount: t.Optional(t.Number()),
            language: t.Optional(t.String()),
          }),
        },
      )
      .post(
        "/submit",
        withIdempotency(async ({ user, body }: any) => {
          return container.dsa.submitAttempt(
            user.id,
            body.sessionId,
            body.index,
            body.code,
            body.phase,
            body.timeTaken,
          );
        }),
        {
          body: t.Object({
            sessionId: t.String(),
            index: t.Number(),
            code: t.Optional(t.String()),
            phase: t.Optional(t.String()),
            timeTaken: t.Optional(t.Number()),
          }),
        },
      )
      .get("/session/:id", async ({ params: { id }, user }) => {
        return container.dsa.getSession(user.id, id);
      })
      .post(
        "/evaluate",
        withIdempotency(async ({ user, body }: any) => {
          return container.dsa.evaluateSession(user.id, body.sessionId);
        }),
        {
          body: t.Object({ sessionId: t.String() }),
        },
      ),
  );
