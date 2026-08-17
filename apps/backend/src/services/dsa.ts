import type { PrismaClient } from "@evalio/db";
import { NotFoundError, ValidationError, AppError } from "../lib/errors";
import { DSA_PHASES } from "@evalio/prompts";
import { fetchCompanyQuestions, getOrCreateQuestion } from "./questionPool";

export class DsaService {
  constructor(private prisma: PrismaClient) {}

  async startSession(
    userId: string,
    interviewId: string,
    bodyQc?: number | null,
    language?: string | null,
  ) {
    let defaultCount = 3;
    if (bodyQc === undefined || bodyQc === null) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      const userRole = userRecord?.role ?? "FREE";
      defaultCount = userRole === "ADMIN" || userRole === "PRO" ? 4 : 2;
    }

    const count =
      typeof bodyQc === "number" &&
      Number.isInteger(bodyQc) &&
      bodyQc >= 1 &&
      bodyQc <= 5
        ? bodyQc
        : defaultCount;

    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");
    if (interview.mode !== "LIVE_CODE")
      throw new ValidationError("Interview is not in DSA mode");

    const existing = await this.prisma.dsaSession.findUnique({
      where: { interviewId },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    if (existing) return { session: existing };

    if (!interview.companyId)
      throw new ValidationError("Interview has no company assigned");

    let questions: Array<{
      id: number;
      title: string;
      slug: string;
      difficulty: string;
      acceptanceRate: number;
    }>;

    try {
      questions = await fetchCompanyQuestions(interview.companyId, count);
    } catch {
      throw new AppError("Failed to fetch questions. Please try again.", 502);
    }

    if (questions.length === 0)
      throw new AppError("No questions found for this company", 404);

    const enriched = await Promise.all(
      questions.map((q) =>
        getOrCreateQuestion(
          q.slug,
          q.id,
          q.difficulty as "EASY" | "MEDIUM" | "HARD",
          q.acceptanceRate,
        ).then((dbQ) => ({
          title: dbQ.title,
          slug: dbQ.slug,
          difficulty: dbQ.difficulty,
          description: dbQ.description ?? "",
        })),
      ),
    );

    const session = await this.prisma.dsaSession.create({
      data: {
        interviewId,
        userId,
        ...(language ? { language } : {}),
        problems: {
          create: enriched.map((q, idx) => ({
            index: idx,
            title: q.title,
            slug: q.slug,
            difficulty: q.difficulty,
            description: q.description,
            currentPhase: "understanding",
            phasesCompleted: [],
          })),
        },
      },
      include: { problems: { orderBy: { index: "asc" } } },
    });

    return { session };
  }

  async submitAttempt(
    userId: string,
    sessionId: string,
    index: number,
    code?: string,
    phase?: string,
    timeTaken?: number,
  ) {
    const session = await this.prisma.dsaSession.findUnique({
      where: { id: sessionId },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    if (!session || session.userId !== userId)
      throw new NotFoundError("Session not found");

    const problem = session.problems[index];
    if (!problem) throw new NotFoundError("Problem not found");

    const updateData: Record<string, unknown> = {};

    if (code !== undefined) {
      updateData.code = code;
      const currentSnapshots = (problem.codeSnapshots ?? {}) as Record<
        string,
        string
      >;
      const currentPhase =
        phase && DSA_PHASES.includes(phase as (typeof DSA_PHASES)[number])
          ? phase
          : problem.currentPhase;
      currentSnapshots[currentPhase] = code;
      updateData.codeSnapshots = currentSnapshots;
    }

    if (phase && DSA_PHASES.includes(phase as (typeof DSA_PHASES)[number])) {
      updateData.currentPhase = phase;
      const completed = [...problem.phasesCompleted];
      const phaseIdx = DSA_PHASES.indexOf(phase as (typeof DSA_PHASES)[number]);
      if (phaseIdx > 0) {
        const prevPhase = DSA_PHASES[phaseIdx - 1]!;
        if (!completed.includes(prevPhase)) completed.push(prevPhase);
      }
      updateData.phasesCompleted = completed;

      if (phase === "review") {
        if (!completed.includes("implementation"))
          completed.push("implementation");
        if (!completed.includes("testing")) completed.push("testing");
        completed.push("review");
        updateData.phasesCompleted = completed;
        updateData.completedAt = new Date();
      }
    }

    if (timeTaken !== undefined) updateData.timeTaken = timeTaken;

    await this.prisma.dsaProblem.update({
      where: { id: problem.id },
      data: updateData,
    });

    if (phase === "review") {
      await this.prisma.dsaSession.update({
        where: { id: sessionId },
        data: {
          currentIndex: Math.min(index + 1, session.problems.length - 1),
        },
      });
    }

    const updated = await this.prisma.dsaProblem.findUnique({
      where: { id: problem.id },
    });

    return { attempt: updated };
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.dsaSession.findUnique({
      where: { id: sessionId },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    if (!session || session.userId !== userId)
      throw new NotFoundError("Session not found");
    return { session };
  }

  async evaluateSession(userId: string, sessionId: string) {
    const session = await this.prisma.dsaSession.findUnique({
      where: { id: sessionId },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    if (!session || session.userId !== userId)
      throw new NotFoundError("Session not found");

    await this.prisma.dsaSession.update({
      where: { id: sessionId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    return { status: "ok" as const };
  }
}
