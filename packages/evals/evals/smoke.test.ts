import { describe, test, expect } from "bun:test";
import {
  hashQuestion,
  normalizeQuestion,
  cosineSimilarity,
  findExactDuplicate,
} from "@evalio/memory";
import { AIError } from "@evalio/ai";

describe("workspace wiring smoke test", () => {
  test("question dedup utilities resolve from @evalio/memory", () => {
    expect(normalizeQuestion("  How have you used Redis? ")).toBe(
      "how have you used redis",
    );
    expect(hashQuestion("Redis caching")).toBe(
      hashQuestion("  redis caching! "),
    );
    expect(
      findExactDuplicate("How have you used Redis?", [
        "How have you used Redis?",
      ]),
    ).toBe("How have you used Redis?");
    expect(
      findExactDuplicate("Design a rate limiter", ["How have you used Redis?"]),
    ).toBeNull();
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 3);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 3);
  });

  test("AIError resolves from @evalio/ai", () => {
    const err = new AIError("boom", 429);
    expect(err.name).toBe("AIError");
    expect(err.status).toBe(429);
  });
});
