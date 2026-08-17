import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "@evalio/db";
import { applyEvidence } from "@evalio/memory";
import { createUser, cleanupUser } from "../datasets/helpers";

const EMAIL = `eval-updates-${Date.now()}@test.dev`;

describe("Eval 5 — memory evolution", () => {
  let memoryId: string;

  beforeAll(async () => {
    const user = await createUser(EMAIL);
    const memory = await prisma.memory.create({
      data: {
        userId: user.id,
        sourceInterviewId: "fixture-interview",
        type: "FAILURE_PATTERN",
        category: "Kubernetes",
        content: "Candidate struggles with Kubernetes networking.",
        confidence: 0.8,
        importance: 0.9,
        status: "ACTIVE",
      },
    });
    memoryId = memory.id;
  });

  afterAll(async () => {
    await cleanupUser(EMAIL);
  });

  test("confidence evolves 0.8 -> 0.82 -> 0.615 -> 0.34 and flips to IMPROVING", async () => {
    // Interview #1: poor answer reinforces the weakness.
    const s1 = await applyEvidence(memoryId, 0.1);
    expect(s1?.confidence).toBeCloseTo(0.82, 2);
    expect(s1?.status).toBe("ACTIVE");

    // Interview #2: good answer weakens it.
    const s2 = await applyEvidence(memoryId, -0.25);
    expect(s2?.confidence).toBeCloseTo(0.615, 2);
    expect(s2?.status).toBe("IMPROVING");

    // Interview #3: excellent answer weakens it further.
    const s3 = await applyEvidence(memoryId, -0.45);
    expect(s3!.confidence).toBeLessThan(s2!.confidence);
    expect(s3?.confidence).toBeCloseTo(0.34, 2);
    expect(s3?.status).toBe("IMPROVING");

    // The memory is mutable — it must never stay frozen as a weakness.
    const persisted = await prisma.memory.findUnique({
      where: { id: memoryId },
      select: { confidence: true, status: true },
    });
    expect(persisted?.confidence).toBeCloseTo(0.34, 2);
    expect(persisted?.status).toBe("IMPROVING");
  });
});
