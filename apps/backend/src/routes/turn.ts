import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";

async function verifyInterview(
  interviewId: string,
  userId: string,
  set: Record<string, unknown>,
) {
  const interview = await prisma.interviewSession.findUnique({
    where: { id: interviewId },
  });
  if (!interview || interview.userId !== userId) {
    set.status = 404;
    return null;
  }
  return interview;
}

export const turnRoutes = new Elysia().guard({}, (app) =>
  app
    .use(authGuard)
    .post(
      "/interview/:id/turns",
      async ({ params: { id }, user, body, set }) => {
        if (!(await verifyInterview(id, user.id, set))) return;

        const maxOrder = await prisma.interviewTurn.findFirst({
          where: { interviewId: id },
          orderBy: { orderNumber: "desc" },
          select: { orderNumber: true },
        });

        const turn = await prisma.interviewTurn.create({
          data: {
            interviewId: id,
            orderNumber: (maxOrder?.orderNumber ?? 0) + 1,
            questionText: body.questionText,
            answerText: body.answerText ?? "",
            questionStartMs: body.questionStartMs ?? null,
            answerStartMs: body.answerStartMs ?? null,
            answerEndMs: body.answerEndMs ?? null,
            score: body.score ?? null,
            feedback: body.feedback ?? null,
          },
        });
        return { turn };
      },
      {
        body: t.Object({
          questionText: t.String(),
          answerText: t.Optional(t.String()),
          questionStartMs: t.Optional(t.Nullable(t.Number())),
          answerStartMs: t.Optional(t.Nullable(t.Number())),
          answerEndMs: t.Optional(t.Nullable(t.Number())),
          score: t.Optional(t.Nullable(t.Number())),
          feedback: t.Optional(t.Nullable(t.String())),
        }),
      },
    )
    .get(
      "/interview/:id/turns",
      async ({ params: { id }, user, query, set }: any) => {
        if (!(await verifyInterview(id, user.id, set))) return;

        const take = Math.min(Number(query.take) || 50, 200);
        const cursor = query.cursor;

        const turns = await prisma.interviewTurn.findMany({
          where: { interviewId: id },
          orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
          take: take + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasMore = turns.length > take;
        const results = hasMore ? turns.slice(0, take) : turns;
        const nextCursor = hasMore ? results[results.length - 1]!.id : null;

        return { turns: results, nextCursor };
      },
    )
    .get(
      "/interview/:id/turns/:turnId",
      async ({ params: { id, turnId }, user, set }) => {
        if (!(await verifyInterview(id, user.id, set))) return;

        const turn = await prisma.interviewTurn.findUnique({
          where: { id: turnId },
        });
        if (!turn || turn.interviewId !== id) {
          set.status = 404;
          return { error: "Turn not found" };
        }
        return { turn };
      },
    )
    .patch(
      "/interview/:id/turns/:turnId",
      async ({ params: { id, turnId }, user, body, set }) => {
        if (!(await verifyInterview(id, user.id, set))) return;

        const turn = await prisma.interviewTurn.findUnique({
          where: { id: turnId },
        });
        if (!turn || turn.interviewId !== id) {
          set.status = 404;
          return { error: "Turn not found" };
        }

        const updated = await prisma.interviewTurn.update({
          where: { id: turnId },
          data: {
            ...(body.answerText !== undefined && {
              answerText: body.answerText,
            }),
            ...(body.answerStartMs !== undefined && {
              answerStartMs: body.answerStartMs,
            }),
            ...(body.answerEndMs !== undefined && {
              answerEndMs: body.answerEndMs,
            }),
            ...(body.score !== undefined && { score: body.score }),
            ...(body.feedback !== undefined && { feedback: body.feedback }),
          },
        });
        return { turn: updated };
      },
      {
        body: t.Object({
          answerText: t.Optional(t.String()),
          answerStartMs: t.Optional(t.Nullable(t.Number())),
          answerEndMs: t.Optional(t.Nullable(t.Number())),
          score: t.Optional(t.Nullable(t.Number())),
          feedback: t.Optional(t.Nullable(t.String())),
        }),
      },
    ),
);
