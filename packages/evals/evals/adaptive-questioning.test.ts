import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { generateJson } from "@evalio/ai";
import { buildMemoryBrief } from "@evalio/memory";
import { resolveRoute, buildPromptFromRoute } from "@evalio/prompts";
import { seedCandidate1, cleanupCandidate1 } from "../datasets/candidate_1";

const hasNvidia = !!Bun.env.NVIDIA_API_KEY;

interface JudgeScore {
  memoryUsage: number;
  weaknessTargeting: number;
  nonRepetition: number;
  difficulty: number;
  summary?: string;
}

const JUDGE_SCHEMA = z.object({
  memoryUsage: z.number().min(0).max(3),
  weaknessTargeting: z.number().min(0).max(3),
  nonRepetition: z.number().min(0).max(3),
  difficulty: z.number().min(0).max(3),
  summary: z.string().optional(),
});

const JUDGE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    memoryUsage: { type: "number" },
    weaknessTargeting: { type: "number" },
    nonRepetition: { type: "number" },
    difficulty: { type: "number" },
    summary: { type: "string" },
  },
  required: ["memoryUsage", "weaknessTargeting", "nonRepetition", "difficulty"],
} as const;

const JUDGE_SYSTEM =
  "You are an expert technical interview coach evaluating an AI interviewer's SYSTEM PROMPT. " +
  "Score each dimension 0 (fails) to 3 (excellent). " +
  "memoryUsage: does the prompt leverage candidate memory to personalize? " +
  "weaknessTargeting: does it direct the interviewer to probe known weak areas? " +
  "nonRepetition: does it prevent re-asking previously asked questions? " +
  "difficulty: does it drive appropriately challenging questions? " +
  "Return ONLY valid JSON.";

async function judgePrompt(systemPrompt: string): Promise<JudgeScore> {
  return generateJson<JudgeScore>({
    system: JUDGE_SYSTEM,
    prompt: `System prompt under evaluation:\n\n${systemPrompt.slice(0, 12000)}`,
    jsonSchema: JUDGE_JSON_SCHEMA,
    schema: JUDGE_SCHEMA,
  });
}

function total(s: JudgeScore): number {
  return s.memoryUsage + s.weaknessTargeting + s.nonRepetition + s.difficulty;
}

describe.skipIf(!hasNvidia)(
  "Eval 4 — adaptive interviewing (prompt judge)",
  () => {
    let userId: string;
    let memoryPrompt: string;
    let baselinePrompt: string;

    beforeAll(async () => {
      userId = (
        await seedCandidate1({
          questions: ["What is Kubernetes?", "Explain Kubernetes Services."],
        })
      ).id;

      const brief = await buildMemoryBrief(userId, "Backend Engineer");
      expect(brief).toBeTruthy();

      const route = resolveRoute(null, "VOICE");
      const base = {
        position: "Backend Engineer",
        candidateName: null,
        resumeText: null,
        jobDescription: null,
        githubUsername: null,
        githubSummary: null,
        githubLanguages: [],
        githubProjects: [],
        durationMinutes: 30,
        interviewStyle: "PROFESSIONAL" as const,
        interviewDepth: "STANDARD" as const,
        companyName: null,
        companyCulture: null,
        companyInterviewerBehavior: null,
        companyEvaluationBiases: null,
        roleTopics: null,
        roleEvaluationCriteria: null,
        roleMustProbe: null,
        interviewRound: null,
        candidateHistory: [],
        overallMostImproved: null,
        overallWeakest: null,
        overallPatterns: [],
        scoreTrendLast5: null,
      };

      memoryPrompt = buildPromptFromRoute(route, {
        voiceInput: { ...base, memoryBrief: brief },
      });
      baselinePrompt = buildPromptFromRoute(route, { voiceInput: base });
    });

    afterAll(async () => {
      await cleanupCandidate1();
    });

    test("memory brief is embedded in the prompt; baseline is not", () => {
      expect(memoryPrompt).toContain("## Candidate Memory Brief");
      expect(memoryPrompt).toMatch(/Kubernetes/i);
      expect(memoryPrompt).toMatch(/What is Kubernetes\?/);
      expect(memoryPrompt).toMatch(/Explain Kubernetes Services\./);
      expect(baselinePrompt).not.toContain("## Candidate Memory Brief");
    });

    test("judge scores the memory-aware prompt higher than the baseline", async () => {
      const withMem = await judgePrompt(memoryPrompt);
      const base = await judgePrompt(baselinePrompt);

      console.log("with-memory:", withMem);
      console.log("baseline:   ", base);
      console.log(
        `total: with-memory=${total(withMem)} baseline=${total(base)}`,
      );

      expect(withMem.memoryUsage).toBeGreaterThanOrEqual(2);
      expect(withMem.nonRepetition).toBeGreaterThanOrEqual(2);
      expect(total(withMem)).toBeGreaterThanOrEqual(total(base));
    }, 60_000);
  },
);
