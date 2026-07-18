import { Elysia } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { withIdempotency } from "../middleware/idempotency";

export const evaluateRoutes = new Elysia().guard({}, (app) =>
  app
    .use(authGuard)
    .get("/interview/:id/evaluate/status", async ({ params: { id }, user }) => {
      return container.evaluate.getStatus(user.id, id);
    })
    .post(
      "/interview/:id/evaluate",
      withIdempotency(async ({ params: { id }, user }: any) => {
        return container.evaluate.evaluate(user.id, id);
      }),
    ),
);
