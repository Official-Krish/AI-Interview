import type { PrismaClient } from "@evalio/db";
import { NotFoundError } from "../lib/errors";

export class AnalysisService {
  constructor(private prisma: PrismaClient) {}

  async getInterviewAnalysis(userId: string, interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
      include: {
        turns: { orderBy: { orderNumber: "asc" } },
        summary: true,
        resume: { select: { id: true, version: true, objectKey: true } },
        dsaSession: {
          include: { problems: { orderBy: { index: "asc" } } },
        },
      },
    });

    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");

    const allSessions = await this.prisma.interviewSession.findMany({
      where: {
        userId,
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

    const skillProfile = await this.prisma.candidateSkillProfile.findUnique({
      where: { userId },
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
  }

  async getAllAnalysis(userId: string) {
    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        userId,
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

    const skillProfile = await this.prisma.candidateSkillProfile.findUnique({
      where: { userId },
    });

    return { sessions, skillProfile };
  }
}

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
