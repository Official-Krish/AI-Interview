import type { PrismaClient } from "@evalio/db";
import { NotFoundError, ValidationError, AppError } from "../lib/errors";
import { extractUsername, parseGithubProfile } from "../utils/githubParser";
import type { InterviewStyle, InterviewDepth } from "@evalio/db";

export interface InterviewData {
  position?: string;
  resumeId?: string;
  githubUrl?: string;
  jobDescription?: string;
  companyId?: string;
  companyName?: string;
  roleTitle?: string;
  roleCategory?: string;
  interviewRound?: string;
  interviewStyle?: InterviewStyle;
  interviewDepth?: InterviewDepth;
  mode?: "VOICE" | "LIVE_CODE" | "LIVE_CANVAS" | "DISCUSSION";
}

export interface InterviewUpdateData {
  status?: "CREATED" | "ACTIVE" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds?: number | null;
}

export class InterviewService {
  constructor(private prisma: PrismaClient) {}

  async create(userId: string, role: string, data: InterviewData) {
    if (role !== "ADMIN") {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentCount = await this.prisma.interviewSession.count({
        where: {
          userId,
          createdAt: { gte: since },
        },
      });
      const limit = role === "PRO" ? 6 : 3;
      if (recentCount >= limit) {
        throw new AppError(
          `Rate limit reached. ${
            role === "PRO" ? "Pro" : "Free"
          } users can only create ${limit} interviews per 7 days.`,
          429,
          "RATE_LIMITED",
        );
      }
    }

    if (data.resumeId) {
      const resume = await this.prisma.resume.findFirst({
        where: { id: data.resumeId, userId },
      });
      if (!resume) {
        throw new ValidationError("Invalid resume selected");
      }
    } else {
      const latestResume = await this.prisma.resume.findFirst({
        where: { userId },
        orderBy: { version: "desc" },
      });
      if (!latestResume) {
        throw new ValidationError(
          "Upload a resume before creating an interview",
        );
      }
      data.resumeId = latestResume.id;
    }

    if (data.githubUrl) {
      const username = extractUsername(data.githubUrl);
      if (username) {
        try {
          const parsed = await parseGithubProfile(username);
          await this.prisma.githubProfile.upsert({
            where: { userId },
            create: {
              userId,
              username: parsed.username,
              summary: parsed.summary,
              languages: parsed.languages,
              projects: parsed.projects,
            },
            update: {
              username: parsed.username,
              summary: parsed.summary,
              languages: parsed.languages,
              projects: parsed.projects,
              analyzedAt: new Date(),
            },
          });
          await this.prisma.candidateProfile.update({
            where: { userId },
            data: { githubUsername: parsed.username },
          });
        } catch {
          // GitHub fetch failed, continue without profile
        }
      }
    }

    const interview = await this.prisma.interviewSession.create({
      data: {
        userId,
        status: "CREATED",
        mode:
          (data.mode as "VOICE" | "LIVE_CODE" | "LIVE_CANVAS" | "DISCUSSION") ??
          "VOICE",
        position: data.position,
        jobDescription: data.jobDescription,
        resumeId: data.resumeId,
        ...(data.companyId && { companyId: data.companyId }),
        ...(data.companyName && { companyName: data.companyName }),
        ...(data.roleTitle && { roleTitle: data.roleTitle }),
        ...(data.roleCategory && { roleCategory: data.roleCategory }),
        ...(data.interviewRound && { interviewRound: data.interviewRound }),
        ...(data.interviewStyle && {
          interviewStyle: data.interviewStyle as InterviewStyle,
        }),
        ...(data.interviewDepth && {
          interviewDepth: data.interviewDepth as InterviewDepth,
        }),
      },
    });

    return { interview };
  }

  async list(userId: string, cursor?: string, take?: number, skip?: number) {
    const limit = Math.min(take || 20, 100);

    const interviews = await this.prisma.interviewSession.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: skip || 0 }),
      include: {
        _count: { select: { turns: true } },
        resume: { select: { id: true, version: true } },
        summary: true,
      },
    });

    const hasMore = interviews.length > limit;
    const results = hasMore ? interviews.slice(0, limit) : interviews;
    const nextCursor = hasMore ? results[results.length - 1]!.id : null;

    return { interviews: results, nextCursor };
  }

  async get(
    id: string,
    userId: string,
    generateResumeUrl: (key: string) => string | null,
  ) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id },
      include: {
        turns: { orderBy: { createdAt: "asc" } },
        summary: true,
        resume: { select: { id: true, version: true, objectKey: true } },
        dsaSession: {
          include: {
            problems: { orderBy: { index: "asc" } },
          },
        },
      },
    });

    if (!interview || interview.userId !== userId) {
      throw new NotFoundError("Interview");
    }

    const mappedResume = interview.resume
      ? {
          ...interview.resume,
          url: interview.resume.objectKey
            ? generateResumeUrl(interview.resume.objectKey)
            : null,
        }
      : null;

    const scoredInterviews = await this.prisma.interviewSession.findMany({
      where: {
        userId,
        status: "COMPLETED",
        overallScore: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { overallScore: true },
    });
    const scores = scoredInterviews.map((i) => i.overallScore!).reverse();
    const scoreTrendLast5: "improving" | "stable" | "declining" | null =
      scores.length < 2
        ? null
        : scores[scores.length - 1]! > scores[0]! + 5
          ? "improving"
          : scores[scores.length - 1]! < scores[0]! - 5
            ? "declining"
            : "stable";

    return {
      interview: {
        ...interview,
        resume: mappedResume,
        scoreTrendLast5,
      },
    };
  }

  async update(id: string, userId: string, data: InterviewUpdateData) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id },
    });

    if (!interview || interview.userId !== userId) {
      throw new NotFoundError("Interview");
    }

    const updated = await this.prisma.interviewSession.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
        ...(data.endedAt !== undefined && { endedAt: data.endedAt }),
        ...(data.durationSeconds !== undefined && {
          durationSeconds: data.durationSeconds,
        }),
      },
    });

    return { interview: updated };
  }
}
