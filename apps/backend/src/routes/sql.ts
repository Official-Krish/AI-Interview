import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { withIdempotency } from "../middleware/idempotency";

export const sqlRoutes = new Elysia({ prefix: "/sql" })
  .use(authGuard)
  .guard({}, (app) =>
    app
      .post(
        "/start",
        withIdempotency(async ({ user, body }: any) => {
          return container.sql.startSession(user.id, body.interviewId);
        }),
        {
          body: t.Object({ interviewId: t.String() }),
        },
      )
      .get("/session/:id", async ({ params: { id }, user }) => {
        return container.dsa.getSession(user.id, id);
      }),
  );
