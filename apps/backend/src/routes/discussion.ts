import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
export { clearDiscussionQuestion } from "../services/question";

export const discussionRoutes = new Elysia({ prefix: "/discussion" })
  .use(authGuard)
  .guard({}, (app) =>
    app.post(
      "/start",
      async ({ user, body }) => {
        return container.question.startDiscussionQuestion(
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
