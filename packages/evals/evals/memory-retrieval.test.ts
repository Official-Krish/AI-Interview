import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { retrieveMemories } from "@evalio/memory";
import { seedCandidate1, cleanupCandidate1 } from "../datasets/candidate_1";

const hasGemini = !!Bun.env.GEMINI_API_KEY;

interface QueryCase {
  query: string;
  expectedCategory: string;
}

const QUERIES: QueryCase[] = [
  { query: "Kubernetes ingress debugging", expectedCategory: "Kubernetes" },
  { query: "Redis caching patterns", expectedCategory: "Redis" },
  { query: "TypeScript type safety", expectedCategory: "TypeScript" },
  {
    query: "PostgreSQL database administration",
    expectedCategory: "PostgreSQL",
  },
];

describe.skipIf(!hasGemini)("Eval 2 — memory retrieval (RAG metrics)", () => {
  let userId: string;

  beforeAll(async () => {
    userId = (await seedCandidate1()).id;
  });

  afterAll(async () => {
    await cleanupCandidate1();
  });

  test("semantic retrieval returns relevant memories (precision@k, recall@k, MRR)", async () => {
    const precAt1: number[] = [];
    const recAt2: number[] = [];
    const mrrs: number[] = [];

    for (const q of QUERIES) {
      const results = await retrieveMemories(userId, q.query, 3);
      const rank = results.findIndex((r) => r.category === q.expectedCategory);

      precAt1.push(rank === 0 ? 1 : 0);
      recAt2.push(rank >= 0 && rank < 2 ? 1 : 0);
      mrrs.push(rank >= 0 ? 1 / (rank + 1) : 0);

      console.log(
        `[${q.query}] -> `,
        results
          .map((r) => `${r.category}@${r.similarity.toFixed(3)}`)
          .join(", "),
        `(expected ${q.expectedCategory}: rank ${rank})`,
      );
    }

    const avgP1 = precAt1.reduce((a, b) => a + b, 0) / QUERIES.length;
    const avgR2 = recAt2.reduce((a, b) => a + b, 0) / QUERIES.length;
    const avgMrr = mrrs.reduce((a, b) => a + b, 0) / QUERIES.length;

    console.log(
      `metrics: precision@1=${avgP1.toFixed(2)} recall@2=${avgR2.toFixed(2)} MRR@3=${avgMrr.toFixed(2)}`,
    );

    expect(avgP1).toBeGreaterThan(0.5);
    expect(avgR2).toBeGreaterThan(0.75);
    expect(avgMrr).toBeGreaterThan(0.5);
  });

  test("'Kubernetes ingress debugging' surfaces the networking weakness first", async () => {
    const results = await retrieveMemories(
      userId,
      "Kubernetes ingress debugging",
      3,
    );
    expect(results[0]?.category).toBe("Kubernetes");
    expect(results[0]?.content).toMatch(/Kubernetes networking|ingress/i);
    expect(results[0]?.similarity).toBeGreaterThan(0.5);
  });
});
