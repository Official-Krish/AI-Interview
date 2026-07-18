import type { PrismaClient } from "@evalio/db";
import { NotFoundError } from "../lib/errors";

export class TurnService {
  constructor(private prisma: PrismaClient) {}

  async create(
    userId: string,
    interviewId: string,
    body: {
      questionText: string;
      answerText?: string;
      questionStartMs?: number | null;
      answerStartMs?: number | null;
      answerEndMs?: number | null;
      score?: number | null;
      feedback?: string | null;
    },
  ) {
    await this.verifyInterview(interviewId, userId);

    const maxOrder = await this.prisma.interviewTurn.findFirst({
      where: { interviewId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    const turn = await this.prisma.interviewTurn.create({
      data: {
        interviewId,
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
  }

  async list(
    userId: string,
    interviewId: string,
    takeParam: number,
    cursor?: string,
  ) {
    await this.verifyInterview(interviewId, userId);

    const take = Math.min(takeParam || 50, 200);

    const turns = await this.prisma.interviewTurn.findMany({
      where: { interviewId },
      orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = turns.length > take;
    const results = hasMore ? turns.slice(0, take) : turns;
    const nextCursor = hasMore ? results[results.length - 1]!.id : null;

    return { turns: results, nextCursor };
  }

  async getById(userId: string, interviewId: string, turnId: string) {
    await this.verifyInterview(interviewId, userId);

    const turn = await this.prisma.interviewTurn.findUnique({
      where: { id: turnId },
    });
    if (!turn || turn.interviewId !== interviewId)
      throw new NotFoundError("Turn not found");
    return { turn };
  }

  async update(
    userId: string,
    interviewId: string,
    turnId: string,
    body: {
      answerText?: string;
      answerStartMs?: number | null;
      answerEndMs?: number | null;
      score?: number | null;
      feedback?: string | null;
    },
  ) {
    await this.verifyInterview(interviewId, userId);

    const turn = await this.prisma.interviewTurn.findUnique({
      where: { id: turnId },
    });
    if (!turn || turn.interviewId !== interviewId)
      throw new NotFoundError("Turn not found");

    const updated = await this.prisma.interviewTurn.update({
      where: { id: turnId },
      data: {
        ...(body.answerText !== undefined && { answerText: body.answerText }),
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
  }

  private async verifyInterview(interviewId: string, userId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");
    return interview;
  }
}
