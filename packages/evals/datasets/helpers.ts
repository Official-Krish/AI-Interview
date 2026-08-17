import { prisma, type MemoryType, type MemoryStatus } from "@evalio/db";
import { embed } from "@evalio/ai";

export async function createUser(email: string) {
  await cleanupUser(email);
  return prisma.user.create({
    data: { email, password: "x", role: "FREE" },
  });
}

export async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  await prisma.memory.deleteMany({ where: { userId: user.id } });
  await prisma.interviewTurn.deleteMany({
    where: { interview: { userId: user.id } },
  });
  await prisma.interviewSummary.deleteMany({
    where: { interview: { userId: user.id } },
  });
  await prisma.interviewSession.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

export async function createMemory(input: {
  userId: string;
  sourceInterviewId: string;
  type: MemoryType;
  category: string;
  content: string;
  confidence: number;
  importance: number;
  status?: MemoryStatus;
}) {
  const vec = await embed(input.content);
  const memory = await prisma.memory.create({
    data: {
      userId: input.userId,
      sourceInterviewId: input.sourceInterviewId,
      type: input.type,
      category: input.category,
      content: input.content,
      confidence: input.confidence,
      importance: input.importance,
      status: input.status ?? "ACTIVE",
    },
  });
  await prisma.$executeRaw`
    UPDATE "Memory"
    SET embedding = ${`[${vec.join(",")}]`}::vector
    WHERE id = ${memory.id}
  `;
  return memory;
}

export async function createCompletedInterview(
  userId: string,
  questions: string[],
) {
  const interview = await prisma.interviewSession.create({
    data: {
      userId,
      status: "COMPLETED",
      mode: "VOICE",
      position: "Backend Engineer",
      overallScore: 70,
      endedAt: new Date(),
    },
  });
  for (let i = 0; i < questions.length; i++) {
    await prisma.interviewTurn.create({
      data: {
        interviewId: interview.id,
        orderNumber: i + 1,
        questionText: questions[i]!,
        answerText: "Sample answer for the eval fixture.",
      },
    });
  }
  return interview;
}
