import { Elysia } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { evaluateInterview } from "../services/evaluate";
import { withIdempotency } from "../middleware/idempotency";

export const evaluateRoutes = new Elysia().guard({}, (app) =>
  app
    .use(authGuard)
    .get(
      "/interview/:id/evaluate/status",
      async ({ params: { id }, user, set }) => {
        const interview = await prisma.interviewSession.findUnique({
          where: { id },
          select: {
            userId: true,
            status: true,
            overallScore: true,
            communicationScore: true,
            technicalScore: true,
            problemSolvingScore: true,
            summary: { select: { id: true } },
          },
        });
        if (!interview || interview.userId !== user.id) {
          set.status = 404;
          return { error: "Interview not found" };
        }

        if (interview.status === "FAILED") {
          return { status: "failed" as const };
        }

        const scored =
          interview.overallScore != null && interview.summary != null;

        return {
          status: scored ? "completed" : ("pending" as const),
          scores: scored
            ? {
                overall: interview.overallScore,
                communication: interview.communicationScore,
                technical: interview.technicalScore,
                problemSolving: interview.problemSolvingScore,
              }
            : null,
        };
      },
    )
    .post(
      "/interview/:id/evaluate",
      withIdempotency(async ({ params: { id }, user, set }: any) => {
        const interview = await prisma.interviewSession.findUnique({
          where: { id },
        });
        if (!interview || interview.userId !== user.id) {
          set.status = 404;
          return { error: "Interview not found" };
        }

        try {
          const result = await evaluateInterview(id);
          return result;
        } catch (err) {
          console.error("[evaluate] failed:", err);
          await prisma.interviewSession.update({
            where: { id },
            data: { status: "FAILED" },
          });
          set.status = 500;
          return { error: "Evaluation failed. Please try again." };
        }
      }),
    ),
);
