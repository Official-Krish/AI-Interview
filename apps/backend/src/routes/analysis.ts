import { Elysia } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { cached } from "../lib/cacheMiddleware";

export const analysisRoutes = new Elysia().guard({}, (app) =>
  app
    .use(authGuard)
    .get(
      "/interview/:id/analysis",
      cached(600, async ({ params: { id }, user, set }: any) => {
        const interview = await prisma.interviewSession.findUnique({
          where: { id },
          include: {
            turns: { orderBy: { orderNumber: "asc" } },
            summary: true,
            resume: { select: { id: true, version: true, objectKey: true } },
            dsaSession: {
              include: {
                problems: { orderBy: { index: "asc" } },
              },
            },
          },
        });

        if (!interview || interview.userId !== user.id) {
          set.status = 404;
          return { error: "Interview not found" };
        }

        const allSessions = await prisma.interviewSession.findMany({
          where: {
            userId: user.id,
            status: "COMPLETED",
            overallScore: { not: null },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            companyName: true,
            roleTitle: true,
            overallScore: true,
            communicationScore: true,
            technicalScore: true,
            problemSolvingScore: true,
            createdAt: true,
            mode: true,
          },
        });

        const skillProfile = await prisma.candidateSkillProfile.findUnique({
          where: { userId: user.id },
        });

        return {
          interview: {
            ...interview,
            scoreTrendLast5: computeTrend(
              allSessions.slice(-5).map((s) => s.overallScore!),
            ),
          },
          scoreHistory: allSessions.map((s) => ({
            id: s.id,
            companyName: s.companyName,
            roleTitle: s.roleTitle,
            overallScore: s.overallScore,
            communicationScore: s.communicationScore,
            technicalScore: s.technicalScore,
            problemSolvingScore: s.problemSolvingScore,
            date: s.createdAt,
            mode: s.mode,
          })),
          skillProfile,
        };
      }),
    )
    .get("/analysis", async ({ user }) => {
      const sessions = await prisma.interviewSession.findMany({
        where: {
          userId: user.id,
          status: "COMPLETED",
          overallScore: { not: null },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          companyName: true,
          roleTitle: true,
          overallScore: true,
          communicationScore: true,
          technicalScore: true,
          problemSolvingScore: true,
          durationSeconds: true,
          createdAt: true,
          mode: true,
          summary: {
            select: {
              strengths: true,
              weaknesses: true,
              improvementAreas: true,
              summary: true,
            },
          },
        },
      });

      const skillProfile = await prisma.candidateSkillProfile.findUnique({
        where: { userId: user.id },
      });

      return { sessions, skillProfile };
    }),
);

function computeTrend(
  scores: number[],
): "improving" | "stable" | "declining" | null {
  if (scores.length < 2) return null;
  return scores[scores.length - 1]! > scores[0]! + 5
    ? "improving"
    : scores[scores.length - 1]! < scores[0]! - 5
      ? "declining"
      : "stable";
}
