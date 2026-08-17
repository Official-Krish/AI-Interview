import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { buildMemoryBrief, findSemanticDuplicate } from "@evalio/memory";
import {
  resolveRoute,
  buildPromptFromRoute,
  type PromptInput,
} from "@evalio/prompts";
import { seedCandidate1, cleanupCandidate1 } from "../datasets/candidate_1";
import {
  type DimensionScores,
  average,
  generateNextQuestion,
  judgePromptPair,
  judgeQuestion,
} from "./lib/judge";

const hasNvidia = !!Bun.env.NVIDIA_API_KEY;
const hasGemini = !!Bun.env.GEMINI_API_KEY;

const ASKED_QUESTIONS = ["What is Kubernetes?", "Explain Kubernetes Services."];

function buildVoicePrompt(memoryBrief: string | null): string {
  const route = resolveRoute(null, "VOICE");
  const base: PromptInput = {
    position: "Backend Engineer",
    candidateName: null,
    resumeText: null,
    jobDescription: null,
    githubUsername: null,
    githubSummary: null,
    githubLanguages: [],
    githubProjects: [],
    durationMinutes: 30,
    interviewStyle: "PROFESSIONAL",
    interviewDepth: "STANDARD",
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
  return buildPromptFromRoute(route, {
    voiceInput: { ...base, memoryBrief },
  });
}

describe.skipIf(!hasGemini)(
  "Eval 4A — memory-aware prompt construction",
  () => {
    let memoryPrompt: string;
    let baselinePrompt: string;
    let brief: string | null;

    beforeAll(async () => {
      const user = await seedCandidate1({ questions: ASKED_QUESTIONS });
      brief = await buildMemoryBrief(user.id, "Backend Engineer");
      memoryPrompt = buildVoicePrompt(brief);
      baselinePrompt = buildVoicePrompt(null);
    });

    afterAll(async () => {
      await cleanupCandidate1();
    });

    test("memory brief lists the weakness and previously asked questions", () => {
      expect(brief).toBeTruthy();
      expect(brief).toMatch(/Kubernetes/i);
      expect(brief).toMatch(/ingress/i);
      expect(brief).toContain("What is Kubernetes?");
      expect(brief).toContain("Explain Kubernetes Services.");
    });

    test("memory-aware prompt embeds the brief; baseline does not", () => {
      expect(memoryPrompt).toContain("## Candidate Memory Brief");
      expect(memoryPrompt).toMatch(/Kubernetes/i);
      expect(memoryPrompt).toMatch(/What is Kubernetes\?/);
      expect(memoryPrompt).toMatch(/Explain Kubernetes Services\./);
      expect(memoryPrompt).toContain(
        "NEVER re-ask a question that has already been asked",
      );
      expect(baselinePrompt).not.toContain("## Candidate Memory Brief");
    });
  },
);

describe.skipIf(!hasNvidia)("Eval 4B — prompt quality (pairwise judge)", () => {
  let memoryPrompt: string;
  let baselinePrompt: string;

  beforeAll(async () => {
    const user = await seedCandidate1({ questions: ASKED_QUESTIONS });
    const brief = await buildMemoryBrief(user.id, "Backend Engineer");
    expect(brief).toBeTruthy();
    memoryPrompt = buildVoicePrompt(brief);
    baselinePrompt = buildVoicePrompt(null);
  });

  afterAll(async () => {
    await cleanupCandidate1();
  });

  test("judge picks the memory-aware prompt and scores it well", async () => {
    const result = await judgePromptPair(memoryPrompt, baselinePrompt);

    console.log("winner:", result.winner);
    console.log("promptA (with memory):", {
      memoryUsage: result.memoryUsageA,
      weaknessTargeting: result.weaknessTargetingA,
      nonRepetition: result.nonRepetitionA,
      difficulty: result.difficultyA,
    });
    console.log("promptB (baseline):   ", {
      memoryUsage: result.memoryUsageB,
      weaknessTargeting: result.weaknessTargetingB,
      nonRepetition: result.nonRepetitionB,
      difficulty: result.difficultyB,
    });
    console.log("rationale:", result.rationale);

    expect(result.winner).toBe("A");
    expect(result.memoryUsageA).toBeGreaterThanOrEqual(2);
    expect(result.weaknessTargetingA).toBeGreaterThanOrEqual(2);
    expect(result.nonRepetitionA).toBeGreaterThanOrEqual(2);
    expect(result.difficultyA).toBeGreaterThanOrEqual(2);
  }, 60_000);
});

describe.skipIf(!hasNvidia || !hasGemini)(
  "Eval 4C — adaptive question behavior",
  () => {
    let memoryPrompt: string;
    let brief: string | null;
    const transcript = [
      "Interviewer: What is Kubernetes?\nCandidate: Kubernetes is a container orchestration platform for deploying and managing containerized workloads at scale.",
      "Interviewer: Explain Kubernetes Services.\nCandidate: Services provide stable networking endpoints for a set of pods, enabling discovery and load balancing.",
    ].join("\n\n");

    beforeAll(async () => {
      const user = await seedCandidate1({
        questions: ASKED_QUESTIONS,
        strongKubernetes: true,
      });
      brief = await buildMemoryBrief(user.id, "Backend Engineer");
      expect(brief).toBeTruthy();
      memoryPrompt = buildVoicePrompt(brief);
    });

    afterAll(async () => {
      await cleanupCandidate1();
    });

    test("generated questions are non-repetitive and adaptive", async () => {
      const questions: string[] = [];
      const scores: DimensionScores[] = [];

      for (let i = 0; i < 3; i++) {
        const question = await generateNextQuestion(memoryPrompt, transcript);
        questions.push(question);

        const dup = await findSemanticDuplicate(question, ASKED_QUESTIONS);
        console.log(
          `[gen ${i + 1}]`,
          question,
          dup ? `(dup of: ${dup})` : "(unique)",
        );
        expect(dup).toBeNull();

        const score = await judgeQuestion(
          question,
          ASKED_QUESTIONS,
          brief ?? undefined,
        );
        scores.push(score);
        console.log(`[gen ${i + 1}] score:`, score);
      }

      const avg = average(scores);
      console.log("avg:", avg);

      expect(avg.nonRepetition).toBeGreaterThanOrEqual(2);
      expect(avg.weaknessTargeting).toBeGreaterThanOrEqual(1);
      expect(avg.memoryUsage).toBeGreaterThanOrEqual(1);
      expect(avg.difficulty).toBeGreaterThanOrEqual(1);
    }, 120_000);
  },
);
