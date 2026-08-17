import { describe, test, expect } from "bun:test";
import {
  findExactDuplicate,
  findSemanticDuplicate,
  normalizeQuestion,
  hashQuestion,
} from "@evalio/memory";

const hasGemini = !!Bun.env.GEMINI_API_KEY;

describe("Eval 3 — question deduplication (deterministic)", () => {
  test("exact and normalized variants are duplicates", () => {
    expect(
      findExactDuplicate("How have you used Redis?", [
        "How have you used Redis?",
      ]),
    ).toBe("How have you used Redis?");

    expect(
      findExactDuplicate("  how have you used redis? ", [
        "How have you used Redis?",
      ]),
    ).toBe("How have you used Redis?");

    expect(hashQuestion("Redis caching")).toBe(hashQuestion("redis caching!"));
    expect(normalizeQuestion("Design a rate limiter?").length).toBeGreaterThan(
      0,
    );
  });

  test("distinct question is not an exact duplicate", () => {
    expect(
      findExactDuplicate(
        "How would you design Redis caching for a high-traffic API?",
        ["How have you used Redis?"],
      ),
    ).toBeNull();
  });
});

describe.skipIf(!hasGemini)(
  "Eval 3 — question deduplication (semantic)",
  () => {
    test("paraphrase of an asked question is flagged as duplicate", async () => {
      const dup = await findSemanticDuplicate(
        "Tell me about your experience using Redis.",
        ["How have you used Redis?"],
      );
      console.log("paraphrase ->", dup);
      expect(dup).toBeTruthy();
    });

    test("distinct design question is not a duplicate", async () => {
      const dup = await findSemanticDuplicate(
        "How would you design Redis caching for a high-traffic API?",
        ["How have you used Redis?"],
      );
      console.log("design question ->", dup);
      expect(dup).toBeNull();
    });
  },
);
