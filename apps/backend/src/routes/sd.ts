import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { withIdempotency } from "../middleware/idempotency";
export { clearSdQuestion, getSdQuestion } from "../services/sd";

export const sdRoutes = new Elysia({ prefix: "/sd" })
  .use(authGuard)
  .guard({}, (app) =>
    app.post(
      "/start",
      withIdempotency(async ({ user, body }: any) => {
        return container.sd.startQuestion(user.id, body.interviewId);
      }),
      {
        body: t.Object({ interviewId: t.String() }),
      },
    ),
  );
