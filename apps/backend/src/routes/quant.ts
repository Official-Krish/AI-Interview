import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { withIdempotency } from "../middleware/idempotency";

export const quantRoutes = new Elysia({ prefix: "/quant" })
  .use(authGuard)
  .guard({}, (app) =>
    app.post(
      "/start",
      withIdempotency(async ({ user, body }: any) => {
        return container.quant.startSession(user.id, body.interviewId);
      }),
      {
        body: t.Object({ interviewId: t.String() }),
      },
    ),
  );
