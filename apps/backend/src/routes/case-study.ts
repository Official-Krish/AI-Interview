import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
export { clearCaseStudyQuestion } from "../services/question";

export const caseStudyRoutes = new Elysia({ prefix: "/case-study" })
  .use(authGuard)
  .guard({}, (app) =>
    app.post(
      "/start",
      async ({ user, body }) => {
        return container.question.startCaseStudyQuestion(
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
