import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import {
  fetchCompanyQuestions,
  getOrCreateQuestion,
} from "../services/questionPool";
import { DSA_PHASES } from "../prompt/dsa";

export const dsaRoutes = new Elysia({ prefix: "/dsa" })
  .use(authGuard)
  .guard({}, (app) =>
    app
      .post(
        "/start",
        async ({ user, body, set }) => {
          const { interviewId, questionCount: bodyQc } = body;

          // Determine default question count from user plan
          let defaultCount = 3;
          if (bodyQc === undefined || bodyQc === null) {
            const userRecord = await prisma.user.findUnique({
              where: { id: user.id },
              select: { role: true },
            });
            const userRole = userRecord?.role ?? "FREE";
            const isProOrAdmin = userRole === "ADMIN" || userRole === "PRO";
            defaultCount = isProOrAdmin ? 4 : 2;
          }

          // Validate inputs
          const count =
            typeof bodyQc === "number" &&
            Number.isInteger(bodyQc) &&
            bodyQc >= 1 &&
            bodyQc <= 5
              ? bodyQc
              : defaultCount;

          const interview = await prisma.interviewSession.findUnique({
            where: { id: interviewId },
          });
          if (!interview || interview.userId !== user.id) {
            set.status = 404;
            return { error: "Interview not found" };
          }
          if (interview.mode !== "LIVE_CODE") {
            set.status = 400;
            return { error: "Interview is not in DSA mode" };
          }

          const existing = await prisma.dsaSession.findUnique({
            where: { interviewId },
            include: {
              problems: { orderBy: { index: "asc" } },
            },
          });
          if (existing) return { session: existing };

          if (!interview.companyId) {
            set.status = 400;
            return { error: "Interview has no company assigned" };
          }

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
            set.status = 502;
            return { error: "Failed to fetch questions. Please try again." };
          }

          if (questions.length === 0) {
            set.status = 404;
            return { error: "No questions found for this company" };
          }

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

          const session = await prisma.dsaSession.create({
            data: {
              interviewId,
              userId: user.id,
              ...(body.language ? { language: body.language } : {}),
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
            include: {
              problems: { orderBy: { index: "asc" } },
            },
          });

          return { session };
        },
        {
          body: t.Object({
            interviewId: t.String(),
            questionCount: t.Optional(t.Number()),
            language: t.Optional(t.String()),
          }),
        },
      )
      .post(
        "/submit",
        async ({ user, body, set }) => {
          const { sessionId, index, code, phase, timeTaken } = body;

          const session = await prisma.dsaSession.findUnique({
            where: { id: sessionId },
            include: { problems: { orderBy: { index: "asc" } } },
          });
          if (!session || session.userId !== user.id) {
            set.status = 404;
            return { error: "Session not found" };
          }

          const problem = session.problems[index];
          if (!problem) {
            set.status = 404;
            return { error: "Problem not found" };
          }

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

          if (
            phase &&
            DSA_PHASES.includes(phase as (typeof DSA_PHASES)[number])
          ) {
            updateData.currentPhase = phase;
            const completed = [...problem.phasesCompleted];
            const phaseIdx = DSA_PHASES.indexOf(
              phase as (typeof DSA_PHASES)[number],
            );
            if (phaseIdx > 0) {
              const prevPhase = DSA_PHASES[phaseIdx - 1]!;
              if (!completed.includes(prevPhase)) {
                completed.push(prevPhase);
              }
            }
            updateData.phasesCompleted = completed;

            if (phase === "review") {
              if (!completed.includes("implementation")) {
                completed.push("implementation");
              }
              if (!completed.includes("testing")) {
                completed.push("testing");
              }
              completed.push("review");
              updateData.phasesCompleted = completed;
              updateData.completedAt = new Date();
            }
          }

          if (timeTaken !== undefined) {
            updateData.timeTaken = timeTaken;
          }

          await prisma.dsaProblem.update({
            where: { id: problem.id },
            data: updateData,
          });

          if (phase === "review") {
            await prisma.dsaSession.update({
              where: { id: sessionId },
              data: {
                currentIndex: Math.min(index + 1, session.problems.length - 1),
              },
            });
          }

          const updated = await prisma.dsaProblem.findUnique({
            where: { id: problem.id },
          });

          return { attempt: updated };
        },
        {
          body: t.Object({
            sessionId: t.String(),
            index: t.Number(),
            code: t.Optional(t.String()),
            phase: t.Optional(t.String()),
            timeTaken: t.Optional(t.Number()),
          }),
        },
      )
      .get("/session/:id", async ({ params: { id }, user, set }) => {
        const session = await prisma.dsaSession.findUnique({
          where: { id },
          include: {
            problems: { orderBy: { index: "asc" } },
          },
        });
        if (!session || session.userId !== user.id) {
          set.status = 404;
          return { error: "Session not found" };
        }
        return { session };
      })
      .post(
        "/evaluate",
        async ({ user, body, set }) => {
          const { sessionId } = body;

          const session = await prisma.dsaSession.findUnique({
            where: { id: sessionId },
            include: { problems: { orderBy: { index: "asc" } } },
          });
          if (!session || session.userId !== user.id) {
            set.status = 404;
            return { error: "Session not found" };
          }

          await prisma.dsaSession.update({
            where: { id: sessionId },
            data: { status: "SUBMITTED", submittedAt: new Date() },
          });

          return { status: "ok" };
        },
        {
          body: t.Object({
            sessionId: t.String(),
          }),
        },
      ),
  );
