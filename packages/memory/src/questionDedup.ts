import { createHash } from "node:crypto";
import { embed } from "@evalio/ai";

export const SEMANTIC_DUPLICATE_THRESHOLD = 0.85;

export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashQuestion(text: string): string {
  return createHash("sha1").update(normalizeQuestion(text)).digest("hex");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function findExactDuplicate(
  questionText: string,
  askedQuestions: string[],
): string | null {
  const normalized = normalizeQuestion(questionText);
  const hash = hashQuestion(questionText);
  for (const asked of askedQuestions) {
    if (
      hashQuestion(asked) === hash ||
      normalizeQuestion(asked) === normalized
    ) {
      return asked;
    }
  }
  return null;
}

export async function findSemanticDuplicate(
  questionText: string,
  askedQuestions: string[],
): Promise<string | null> {
  if (askedQuestions.length === 0) return null;

  const exact = findExactDuplicate(questionText, askedQuestions);
  if (exact) return exact;

  const [queryVec, ...askedVecs] = await Promise.all([
    embed(questionText),
    ...askedQuestions.map((q) => embed(q)),
  ]);

  let best: string | null = null;
  let bestSim = SEMANTIC_DUPLICATE_THRESHOLD;
  for (let i = 0; i < askedQuestions.length; i++) {
    const sim = cosineSimilarity(queryVec, askedVecs[i]!);
    if (sim > bestSim) {
      bestSim = sim;
      best = askedQuestions[i]!;
    }
  }
  return best;
}
