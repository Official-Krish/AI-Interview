import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "@evalio/db";
import { extractMemoriesFromInterview } from "@evalio/memory";
import { createUser, cleanupUser } from "../datasets/helpers";

const hasNvidia = !!Bun.env.NVIDIA_API_KEY;
const EMAIL = `eval-extraction-${Date.now()}@test.dev`;

describe.skipIf(!hasNvidia)("Eval 1 — memory extraction", () => {
  let userId: string;
  let interviewId: string;

  beforeAll(async () => {
    const user = await createUser(EMAIL);
    userId = user.id;
    const interview = await prisma.interviewSession.create({
      data: {
        userId,
        status: "COMPLETED",
        mode: "VOICE",
        position: "Backend Engineer",
        overallScore: 74,
        endedAt: new Date(),
      },
    });
    interviewId = interview.id;
    await prisma.interviewSummary.create({
      data: {
        interviewId,
        summary:
          "Redis caching experience; limited Kubernetes networking experience.",
        strengths: ["Redis"],
        weaknesses: ["Kubernetes networking"],
        improvementAreas: ["Kubernetes"],
        recommendedTopics: [],
        resumeStrengths: [],
        resumeWeaknesses: [],
      },
    });
    await prisma.interviewTurn.create({
      data: {
        interviewId,
        orderNumber: 1,
        questionText: "How have you used Redis?",
        answerText:
          "I've used Redis for caching but haven't worked with Redis Streams.",
      },
    });
    await prisma.interviewTurn.create({
      data: {
        interviewId,
        orderNumber: 2,
        questionText: "Describe Kubernetes networking.",
        answerText: "I understand pods but I struggle with ingress debugging.",
      },
    });
  });

  afterAll(async () => {
    await cleanupUser(EMAIL);
  });

  test("extracts Redis caching experience as a grounded SEMANTIC memory", async () => {
    await extractMemoriesFromInterview(interviewId);
    const memories = await prisma.memory.findMany({ where: { userId } });
    console.log(
      "extracted:",
      memories.map((m) => `${m.type}: ${m.content}`),
    );
    expect(memories.length).toBeGreaterThan(0);

    const redisMem = memories.find(
      (m) => /redis/i.test(m.content) && /cach/i.test(m.content),
    );
    expect(redisMem).toBeTruthy();
    expect(redisMem!.type).toBe("SEMANTIC");
    expect(redisMem!.confidence).toBeGreaterThan(0);
    expect(redisMem!.confidence).toBeLessThanOrEqual(1);
    expect(redisMem!.importance).toBeGreaterThan(0);
    expect(redisMem!.importance).toBeLessThanOrEqual(1);
  }, 60_000);

  test("does not hallucinate Redis Streams experience", async () => {
    const memories = await prisma.memory.findMany({ where: { userId } });
    for (const m of memories) {
      if (/stream/i.test(m.content)) {
        // The candidate explicitly said they have NOT worked with Redis Streams,
        // so no memory may claim experience with it.
        expect(
          /experienced|strong|proficient|used .*stream|production/i.test(
            m.content,
          ),
        ).toBe(false);
      }
    }
  });
});
