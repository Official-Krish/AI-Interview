import { z } from "zod";
import { generateJson } from "@evalio/ai";

export interface DimensionScores {
  memoryUsage: number;
  weaknessTargeting: number;
  nonRepetition: number;
  difficulty: number;
}

export const DIMENSION_SCHEMA = z.object({
  memoryUsage: z.number().min(0).max(3),
  weaknessTargeting: z.number().min(0).max(3),
  nonRepetition: z.number().min(0).max(3),
  difficulty: z.number().min(0).max(3),
});

export const DIMENSION_JSON_PROPS = {
  memoryUsage: { type: "number" },
  weaknessTargeting: { type: "number" },
  nonRepetition: { type: "number" },
  difficulty: { type: "number" },
} as const;

export const DIMENSION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: DIMENSION_JSON_PROPS,
  required: ["memoryUsage", "weaknessTargeting", "nonRepetition", "difficulty"],
} as const;

const PROMPT_JUDGE_SYSTEM =
  "You are an expert technical interview coach evaluating two candidate SYSTEM PROMPTS for an AI interviewer. " +
  "Prompt A is the memory-aware variant; Prompt B is the baseline without candidate memory. " +
  "Score each dimension 0 (fails) to 3 (excellent) for each prompt. " +
  "memoryUsage: does the prompt leverage candidate memory to personalize? " +
  "weaknessTargeting: does it direct the interviewer to probe known weak areas? " +
  "nonRepetition: does it prevent re-asking previously asked questions? " +
  "difficulty: does it drive appropriately challenging questions? " +
  "Then pick the overall winner ('A' or 'B') — the prompt that would produce a more adaptive interview. " +
  "Return ONLY valid JSON.";

const QUESTION_JUDGE_SYSTEM =
  "You are an expert technical interview coach evaluating a single interview QUESTION that an AI interviewer just generated. " +
  "Score each dimension 0 (fails) to 3 (excellent). " +
  "memoryUsage: does the question leverage the candidate's known memory (strengths/weaknesses)? " +
  "weaknessTargeting: does it probe the candidate's known weak area or its immediate domain? A question that digs into the weak topic itself (e.g. Kubernetes networking) counts even if it does not name the exact past failure. " +
  "nonRepetition: is it meaningfully different from the questions already asked? " +
  "difficulty: is it appropriately challenging for the scenario? " +
  "Return ONLY valid JSON.";

export interface PairwiseJudge {
  memoryUsageA: number;
  weaknessTargetingA: number;
  nonRepetitionA: number;
  difficultyA: number;
  memoryUsageB: number;
  weaknessTargetingB: number;
  nonRepetitionB: number;
  difficultyB: number;
  winner: "A" | "B";
  rationale: string;
}

const WINNER_SCHEMA = z.object({
  winner: z.enum(["A", "B"]),
  rationale: z.string(),
});

const WINNER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    winner: { type: "string", enum: ["A", "B"] },
    rationale: { type: "string" },
  },
  required: ["winner", "rationale"],
} as const;

const WINNER_SYSTEM =
  "You are an expert technical interview coach. Two system prompts for an AI interviewer are given: A includes candidate memory context, B does not. " +
  "Pick which prompt would produce a more adaptive, personalized interview (leveraging candidate memory, probing weak areas, avoiding repeated questions). " +
  "Return ONLY valid JSON.";

async function pickPromptWinner(
  promptA: string,
  promptB: string,
): Promise<{ winner: "A" | "B"; rationale: string }> {
  return generateJson<{ winner: "A" | "B"; rationale: string }>({
    system: WINNER_SYSTEM,
    prompt: `--- PROMPT A ---\n${promptA.slice(0, 8000)}\n\n--- PROMPT B ---\n${promptB.slice(0, 8000)}\n\nWhich prompt produces a more adaptive interview?`,
    jsonSchema: WINNER_JSON_SCHEMA,
    schema: WINNER_SCHEMA,
  });
}

async function judgePromptDimensions(
  systemPrompt: string,
): Promise<DimensionScores> {
  return generateJson<DimensionScores>({
    system: PROMPT_JUDGE_SYSTEM,
    prompt: `System prompt under evaluation:\n\n${systemPrompt.slice(0, 12000)}`,
    jsonSchema: DIMENSION_JSON_SCHEMA,
    schema: DIMENSION_SCHEMA,
  });
}

export async function judgePromptPair(
  promptA: string,
  promptB: string,
): Promise<PairwiseJudge> {
  const [a, b] = await Promise.all([
    judgePromptDimensions(promptA),
    judgePromptDimensions(promptB),
  ]);
  const pick = await pickPromptWinner(promptA, promptB);
  return {
    memoryUsageA: a.memoryUsage,
    weaknessTargetingA: a.weaknessTargeting,
    nonRepetitionA: a.nonRepetition,
    difficultyA: a.difficulty,
    memoryUsageB: b.memoryUsage,
    weaknessTargetingB: b.weaknessTargeting,
    nonRepetitionB: b.nonRepetition,
    difficultyB: b.difficulty,
    winner: pick.winner,
    rationale: pick.rationale,
  };
}

export async function judgeQuestion(
  question: string,
  askedQuestions: string[],
  memoryHint?: string,
): Promise<DimensionScores> {
  return generateJson<DimensionScores>({
    system: QUESTION_JUDGE_SYSTEM,
    prompt: `Candidate memory:\n${memoryHint ?? "n/a"}\n\nQuestions already asked:\n${askedQuestions.map((q) => `- ${q}`).join("\n")}\n\nInterviewer's next question:\n"${question}"`,
    jsonSchema: DIMENSION_JSON_SCHEMA,
    schema: DIMENSION_SCHEMA,
  });
}

const QUESTION_SCHEMA = z.object({
  question: z.string().min(1),
});

const QUESTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: "string" },
  },
  required: ["question"],
} as const;

export async function generateNextQuestion(
  systemPrompt: string,
  transcript: string,
): Promise<string> {
  const parsed = await generateJson<{ question: string }>({
    system: systemPrompt,
    prompt: `TRANSCRIPT SO FAR:\n${transcript}\n\nWhat focused question do you ask next? Ask exactly one question.`,
    jsonSchema: QUESTION_JSON_SCHEMA,
    schema: QUESTION_SCHEMA,
  });
  return parsed.question;
}

export function total(s: DimensionScores): number {
  return s.memoryUsage + s.weaknessTargeting + s.nonRepetition + s.difficulty;
}

export function average(scores: DimensionScores[]): DimensionScores {
  const n = scores.length || 1;
  const sum = (k: keyof DimensionScores) =>
    scores.reduce((acc, s) => acc + s[k], 0);
  return {
    memoryUsage: sum("memoryUsage") / n,
    weaknessTargeting: sum("weaknessTargeting") / n,
    nonRepetition: sum("nonRepetition") / n,
    difficulty: sum("difficulty") / n,
  };
}
