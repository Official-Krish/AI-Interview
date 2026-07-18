import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { withIdempotency } from "../middleware/idempotency";
import { sendFeedbackThankYouEmail } from "../lib/email";

export const feedbackRoutes = new Elysia({ prefix: "/feedback" }).guard(
  {},
  (app) =>
    app
      .use(authGuard)
      .post(
        "/submit",
        withIdempotency(async ({ user, body }: any) => {
          const feedback = await prisma.feedback.create({
            data: {
              userId: user.id,
              subject: body.subject,
              rating: body.rating,
              category: body.category ?? "General",
              message: body.message,
            },
          });

          try {
            await sendFeedbackThankYouEmail(user.email, user.name ?? "User");
          } catch {
            // non-blocking
          }

          return { feedback };
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
        if (user.role !== "ADMIN") {
          return { feedbacks: [] };
        }
        const feedbacks = await prisma.feedback.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { name: true, email: true } },
          },
        });
        return { feedbacks };
      }),
);
