import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
export { clearCanvasQuestion } from "../services/question";

export const canvasRoutes = new Elysia({ prefix: "/canvas" })
  .use(authGuard)
  .guard({}, (app) =>
    app.post(
      "/start",
      async ({ user, body }) => {
        return container.question.startCanvasQuestion(
          user.id,
          body.interviewId,
        );
      },
      {
        body: t.Object({
          interviewId: t.String(),
        }),
      },
    ),
  );
