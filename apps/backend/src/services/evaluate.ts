import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma";
import { updateCandidateProfile } from "./profile";
import { aggregateFailurePatterns } from "./failurePatterns";
import { aggregateIdentityTraits } from "./identityTraits";
import type { LiveAssessment } from "../ws/tools";
import type { InterviewerRuntime } from "../ws/runtime";
import type { DeterministicState } from "../ws/deterministic";
import { getMomentum, getScoreConfidence } from "../ws/deterministic";

function buildLiveObservationsBlock(
  liveAssessments?: LiveAssessment[],
  interruptionCount?: number,
): string {
  if (!liveAssessments || liveAssessments.length === 0) {
    if (!interruptionCount) return "";
    return `The candidate interrupted the interviewer ${interruptionCount} time(s). Frequent interruptions may indicate assertiveness but can also reflect poor listening. Factor this into the communication score.`;
  }

  const blocks = liveAssessments
    .map(
      (a) =>
        `Turn ${a.orderNumber}:
  confidence: ${a.confidence} | nervousness: ${a.nervousness} | engagement: ${a.engagement}
  clarity: ${a.clarity} | fluency: ${a.fluency} | signal: ${a.signal}${a.hesitationLevel ? `\n  hesitation: ${a.hesitationLevel}` : ""}${a.fillerLevel ? ` | fillers: ${a.fillerLevel}` : ""}
  Note: ${a.rationale}`,
    )
    .join("\n\n");

  return `## Live Behavioral Observations
${blocks}

The observations above reflect delivery cues (tone, pacing, hesitation) captured during the live interview when audio was available. These cues are not recoverable from transcript text alone. Use them to calibrate your scores and per-turn feedback. If the transcript suggests a different conclusion than the live observations, explain the discrepancy in your feedback.
${interruptionCount ? `\nThe candidate interrupted the interviewer ${interruptionCount} time(s). Frequent interruptions may indicate assertiveness but can also reflect poor listening. Factor this into the communication score.` : ""}`;
}

function buildRuntimeBlock(
  runtime?: Pick<
    InterviewerRuntime,
    | "notes"
    | "simplifiedQuestions"
    | "followUps"
    | "recoveryEvents"
    | "overconfidenceDetected"
    | "constraints"
  >,
  liveAssessments?: LiveAssessment[],
): string {
  if (!runtime) return "";
  const parts: string[] = [];

  // ── Behavioral Timeline ──
  if (liveAssessments && liveAssessments.length > 0) {
    const timelineItems: string[] = [];
    for (let i = 0; i < liveAssessments.length; i++) {
      const a = liveAssessments[i]!;
      let entry = `Turn ${a.orderNumber}: confidence=${a.confidence}, signal=${a.signal}`;

      const recovery = runtime.recoveryEvents?.find((r) => r.turn === i + 1);
      if (recovery) entry += ` [RECOVERY: ${recovery.description}]`;

      if (runtime.simplifiedQuestions?.find((sq) => sq.turn === i + 1)) {
        entry += ` [QUESTION SIMPLIFIED]`;
      }

      timelineItems.push(entry);
    }
    parts.push(
      `## Behavioral Timeline\nThe interview progression by turn:\n${timelineItems.join("\n")}\n\nThis timeline shows the trajectory of confidence, signal, recoveries, and simplifications. Use it to evaluate how the candidate handled pressure and adapted over the course of the interview.`,
    );
  }

  if (runtime.recoveryEvents && runtime.recoveryEvents.length > 0) {
    const details = runtime.recoveryEvents
      .map((r) => `Turn ${r.turn}: ${r.description} (${r.type})`)
      .join("\n");
    parts.push(
      `## Recovery Events\n${runtime.recoveryEvents.length} recovery event(s) detected:\n${details}\n\nRecovery is a strong signal of resilience and learning ability. Candidates who recover from struggle or low confidence should be recognized for adaptability.`,
    );
  }

  if (runtime.constraints && runtime.constraints.length > 0) {
    const details = runtime.constraints
      .map(
        (c) =>
          `${c.constraint}=${c.value}${c.revertAfterMs ? ` (reverted after ${c.revertAfterMs}ms)` : ""}`,
      )
      .join("\n");
    parts.push(
      `## Constraints Introduced\n${runtime.constraints.length} constraint(s) were applied:\n${details}\n\nEvaluate how the candidate adapted to changing requirements. Strong candidates adjust their design without needing explicit guidance.`,
    );
  }

  if (runtime.overconfidenceDetected) {
    parts.push(
      `## Overconfidence Flag\nAn overconfidence pattern was detected (3+ consecutive turns rated high confidence). If the transcript shows the candidate making unsupported claims or dismissing tradeoffs, reduce the relevant scores. However, if their high confidence was justified by strong answers, note it as a positive.`,
    );
  }

  if (runtime.notes && runtime.notes.length > 0) {
    const praise = runtime.notes.filter((n) => n.severity === "praise").length;
    const minor = runtime.notes.filter((n) => n.severity === "minor").length;
    const major = runtime.notes.filter((n) => n.severity === "major").length;
    parts.push(
      `## Interviewer Notes\n${runtime.notes.length} note(s) recorded: ${praise} praise, ${minor} minor concerns, ${major} major issues. Factor these into relevant scores.`,
    );
  }

  if (runtime.simplifiedQuestions && runtime.simplifiedQuestions.length > 0) {
    const details = runtime.simplifiedQuestions
      .map(
        (sq) =>
          `Turn ${sq.turn}: simplified (reason: ${sq.reason}${sq.originalDifficulty ? `, originally: ${sq.originalDifficulty}` : ""})`,
      )
      .join("\n");
    parts.push(
      `## Question Simplifications\n${runtime.simplifiedQuestions.length} question(s) were simplified:\n${details}\n\nCandidates who recovered after simplification demonstrated resilience — adjust scores to reward recovery, not penalize the simplification.`,
    );
  }

  const askedFollowUps = runtime.followUps?.filter((f) => f.asked).length ?? 0;
  if (askedFollowUps > 0) {
    parts.push(
      `## Follow-up Tracking\n${askedFollowUps} follow-up(s) were injected. Candidates who engage well with follow-ups demonstrate strong conversational thread awareness. Factor this into the communication score.`,
    );
  }

  return parts.join("\n\n");
}

interface TurnEvaluation {
  orderNumber: number;
  score: number;
  weight: number;
  evidence: string;
  feedback: string;
}

interface Discrepancy {
  turnNumber: number;
  liveScore: number;
  calibratedScore: number;
  direction: "up" | "down" | "unchanged";
  reason: string;
}

interface EvaluationResult {
  overallScore: number;
  overallConfidence: number;
  communicationScore: number;
  communicationConfidence: number;
  technicalScore: number;
  technicalConfidence: number;
  problemSolvingScore: number;
  problemSolvingConfidence: number;
  momentum: "improving" | "stable" | "declining";
  momentumSlope: number;
  summary: string;
  keyStrengths: string[];
  areasForImprovement: string[];
  recommendedTopics: string[];
  resumeStrengths: string[];
  resumeWeaknesses: string[];
  turns: TurnEvaluation[];
  discrepancies: Discrepancy[];
}

const EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Overall interview score 0-100",
    },
    overallConfidence: {
      type: "number",
      description:
        "Confidence in the overall score 0-95% based on evidence volume",
    },
    communicationScore: {
      type: "number",
      description: "Communication skills score 0-100",
    },
    communicationConfidence: {
      type: "number",
      description: "Confidence in communication score 0-95%",
    },
    technicalScore: {
      type: "number",
      description: "Technical knowledge score 0-100",
    },
    technicalConfidence: {
      type: "number",
      description: "Confidence in technical score 0-95%",
    },
    problemSolvingScore: {
      type: "number",
      description: "Problem solving ability score 0-100",
    },
    problemSolvingConfidence: {
      type: "number",
      description: "Confidence in problem solving score 0-95%",
    },
    momentum: {
      type: "string",
      enum: ["improving", "stable", "declining"],
      description: "Score trajectory across the interview",
    },
    momentumSlope: {
      type: "number",
      description: "Linear regression slope of scores over last 5 turns",
    },
    discrepancies: {
      type: "array",
      description:
        "Per-turn score adjustments when live scores conflict with transcript evidence",
      items: {
        type: "object",
        properties: {
          turnNumber: { type: "number" },
          liveScore: {
            type: "number",
            description: "Score assigned by scoreTurn live",
          },
          calibratedScore: {
            type: "number",
            description: "Score after calibration against transcript",
          },
          direction: {
            type: "string",
            enum: ["up", "down", "unchanged"],
            description:
              "Whether the score was adjusted up, down, or unchanged",
          },
          reason: {
            type: "string",
            description: "Why the score was adjusted or why it stayed the same",
          },
        },
        required: [
          "turnNumber",
          "liveScore",
          "calibratedScore",
          "direction",
          "reason",
        ],
      },
    },
    summary: {
      type: "string",
      description: "Brief overall evaluation summary",
    },
    keyStrengths: {
      type: "array",
      items: { type: "string" },
      description: "Top 3-5 key strengths demonstrated",
    },
    areasForImprovement: {
      type: "array",
      items: { type: "string" },
      description: "Top 3-5 areas to improve",
    },
    recommendedTopics: {
      type: "array",
      items: { type: "string" },
      description: "Topics the candidate should study further",
    },
    resumeStrengths: {
      type: "array",
      items: { type: "string" },
      description: "Top 3 things that work well in the candidate's resume",
    },
    resumeWeaknesses: {
      type: "array",
      items: { type: "string" },
      description:
        "Top 3 gaps or improvements needed in the candidate's resume",
    },
    turns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          orderNumber: { type: "number" },
          score: {
            type: "number",
            description: "Score for this turn 0-100",
          },
          weight: {
            type: "number",
            description: "Question importance weight used in weighted average",
          },
          evidence: {
            type: "string",
            description: "Brief evidence of what earned or lost points",
          },
          feedback: {
            type: "string",
            description: "Specific feedback for this answer",
          },
        },
        required: ["orderNumber", "score", "weight", "evidence", "feedback"],
      },
    },
  },
  required: [
    "overallScore",
    "overallConfidence",
    "communicationScore",
    "communicationConfidence",
    "technicalScore",
    "technicalConfidence",
    "problemSolvingScore",
    "problemSolvingConfidence",
    "momentum",
    "momentumSlope",
    "discrepancies",
    "summary",
    "keyStrengths",
    "areasForImprovement",
    "recommendedTopics",
    "resumeStrengths",
    "resumeWeaknesses",
    "turns",
  ],
} as const;

function buildDeterministicBlock(deterministic?: DeterministicState): string {
  if (!deterministic || deterministic.turns.length === 0) return "";

  const scoredTurns = deterministic.turns
    .map(
      (t) =>
        `Turn ${t.turnNumber}: score=${t.score} weight=${t.weight} "${t.evidence}"`,
    )
    .join("\n");

  const runningScore = deterministic.runningScore;
  const momentum = getMomentum(deterministic);
  const confidence = getScoreConfidence(deterministic.turns.length);

  return `## Live Scores (from scoreTurn)

The interviewer scored each turn in real time. Your job is to VALIDATE and CALIBRATE these scores — not replace them. If the transcript supports the live scores, keep them. If the transcript contradicts a live score, adjust it and explain why.

For EVERY turn, report a discrepancy entry: the liveScore, your calibratedScore, the direction, and the reason. If the score is correct as-is, set direction to "unchanged" and explain briefly why the live score was accurate.

Per-turn scores:
${scoredTurns}

Running weighted score: ${runningScore}/100 (confidence: ${confidence}%)
Momentum: ${momentum.direction} (slope: ${momentum.slope.toFixed(1)})

${
  confidence < 70
    ? `Confidence is low (< 70%) because only ${deterministic.turns.length} turn(s) were scored. Focus on providing qualitative feedback for dimensions with thin evidence.`
    : ""
}`;
}

function buildDeterministicContextBlock(
  deterministic?: DeterministicState,
): string {
  if (!deterministic || deterministic.turns.length === 0) return "";

  const scoredTurns = deterministic.turns
    .map(
      (t) =>
        `Turn ${t.turnNumber}: score=${t.score} weight=${t.weight} "${t.evidence}"`,
    )
    .join("\n");

  const runningScore = deterministic.runningScore;
  const momentum = getMomentum(deterministic);
  const confidence = getScoreConfidence(deterministic.turns.length);

  return `## Live Scores (for context)

The interviewer scored each turn in real time. Use these as context alongside the transcript.

Per-turn scores:
${scoredTurns}

Running weighted score: ${runningScore}/100 (confidence: ${confidence}%)
Momentum: ${momentum.direction} (slope: ${momentum.slope.toFixed(1)})`;
}

function buildEvaluationPrompt(input: {
  position: string | null;
  candidateName: string | null;
  resumeText: string | null;
  githubSummary: string | null;
  githubLanguages: string[];
  turns: { orderNumber: number; questionText: string; answerText: string }[];
  liveAssessments?: LiveAssessment[];
  interruptionCount?: number;
  runtime?: Pick<
    InterviewerRuntime,
    | "notes"
    | "simplifiedQuestions"
    | "followUps"
    | "recoveryEvents"
    | "overconfidenceDetected"
    | "constraints"
  >;
  deterministic?: DeterministicState;
}) {
  const questions = input.turns
    .map(
      (t) =>
        `[Question ${t.orderNumber}]: ${t.questionText}\n[Answer ${t.orderNumber}]: ${t.answerText || "(no answer)"}`,
    )
    .join("\n\n");

  const numQuestions = input.turns.length;

  const liveBlock = buildLiveObservationsBlock(
    input.liveAssessments,
    input.interruptionCount,
  );

  const runtimeBlock = buildRuntimeBlock(input.runtime, input.liveAssessments);

  const deterministicBlock = buildDeterministicBlock(input.deterministic);

  return `You are an expert technical interviewer. Evaluate the following interview.

Position: ${input.position || "Unknown"}
Candidate: ${input.candidateName || "Unknown"}
Resume: ${input.resumeText || "Not provided"}
GitHub: ${input.githubSummary || "Not linked"} ${input.githubLanguages.length ? `Languages: ${input.githubLanguages.join(", ")}` : ""}

--- Structured Q&A ---
${questions || "No structured Q&A recorded"}

Provide overall scores for communication, technical knowledge, and problem solving.
List key strengths, areas for improvement, and recommended topics for further study.
Also analyze the candidate's resume briefly — what are its strongest points (resumeStrengths) and what could be improved (resumeWeaknesses)? Keep each to 2-3 items.

## Inter-Question Consistency
${numQuestions > 1 ? "Check for contradictions across questions. If a candidate's answers conflict or they claim expertise on one topic but lack basic knowledge on a related one, note it in the relevant turn feedback and factor it into overall scores. Consistency strengthens credibility; contradictions should reduce the relevant scores." : "Only one question was asked — consistency check is N/A."}

## Accuracy Calibration
Calibrate your scores against what is expected for this specific position (${input.position || "general software engineering"}). A correct but shallow answer should score lower than one that demonstrates depth and seniority-appropriate insight. Consider the resume context when judging whether the candidate met the bar for the role they are applying for.

${liveBlock}

${runtimeBlock}

${deterministicBlock}

## Behavioral Signals
Infer candidate state from the transcript: nervousness (hesitation, hedging), engagement (detailed vs curt answers), and confidence (assertive language vs qualifiers). Factor these into the communication score and relevant turn feedback — a confident well-structured answer should score higher than a hesitant one with the same factual content.`;
}

async function generateEvaluation(
  prompt: string,
): Promise<EvaluationResult | null> {
  const apiKey = Bun.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY env not set");

  const ai = new GoogleGenAI({ apiKey });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: EVALUATION_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) {
        console.warn(
          `[evaluate] empty response, raw:`,
          JSON.stringify(response).slice(0, 500),
        );
        throw new Error("No response from Gemini");
      }

      return JSON.parse(text) as EvaluationResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[evaluate] attempt ${attempt + 1}/2 failed: ${message}`);
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  return null;
}

async function writeEvaluation(
  interviewId: string,
  interviewData: {
    startedAt: Date | null;
    endedAt: Date | null;
  } | null,
  turns: { id: string; orderNumber: number }[],
  result: EvaluationResult,
) {
  const durationSeconds =
    interviewData?.startedAt && interviewData?.endedAt
      ? Math.round(
          (new Date(interviewData.endedAt).getTime() -
            new Date(interviewData.startedAt).getTime()) /
            1000,
        )
      : null;

  await Promise.all([
    prisma.interviewSummary.upsert({
      where: { interviewId },
      create: {
        interviewId,
        summary: result.summary,
        strengths: result.keyStrengths,
        weaknesses: result.areasForImprovement,
        improvementAreas: result.areasForImprovement,
        recommendedTopics: result.recommendedTopics,
        resumeStrengths: result.resumeStrengths,
        resumeWeaknesses: result.resumeWeaknesses,
      },
      update: {
        summary: result.summary,
        strengths: result.keyStrengths,
        weaknesses: result.areasForImprovement,
        improvementAreas: result.areasForImprovement,
        recommendedTopics: result.recommendedTopics,
        resumeStrengths: result.resumeStrengths,
        resumeWeaknesses: result.resumeWeaknesses,
      },
    }),
    prisma.interviewSession.update({
      where: { id: interviewId },
      data: {
        overallScore: result.overallScore,
        overallConfidence: result.overallConfidence,
        communicationScore: result.communicationScore,
        communicationConfidence: result.communicationConfidence,
        technicalScore: result.technicalScore,
        technicalConfidence: result.technicalConfidence,
        problemSolvingScore: result.problemSolvingScore,
        problemSolvingConfidence: result.problemSolvingConfidence,
        momentum: result.momentum,
        momentumSlope: result.momentumSlope,
        discrepancies: result.discrepancies as any,
        durationSeconds,
      },
    }),
    ...result.turns.map((t) => {
      const dbTurn = turns[t.orderNumber - 1];
      if (!dbTurn) return Promise.resolve();
      return prisma.interviewTurn.update({
        where: { id: dbTurn.id },
        data: {
          score: t.score,
          weight: t.weight,
          evidence: t.evidence,
          feedback: t.feedback,
        },
      });
    }),
  ]);

  // Trigger candidate profile update asynchronously
  try {
    await updateCandidateProfile(interviewId);
    await aggregateFailurePatterns(interviewId);
    await aggregateIdentityTraits(interviewId);
  } catch (err) {
    console.error("[evaluate] post-evaluation updates failed:", err);
  }
}

export async function evaluateInterview(
  interviewId: string,
  liveData?: {
    liveAssessments?: LiveAssessment[];
    interruptionCount?: number;
    runtime?: Pick<
      InterviewerRuntime,
      | "notes"
      | "simplifiedQuestions"
      | "followUps"
      | "recoveryEvents"
      | "overconfidenceDetected"
      | "constraints"
    >;
    deterministic?: DeterministicState;
  },
  _retries = 1,
) {
  const interview = await prisma.interviewSession.findUnique({
    where: { id: interviewId },
    select: {
      position: true,
      startedAt: true,
      endedAt: true,
      resume: { select: { extractedText: true } },
      user: {
        select: {
          id: true,
          name: true,
          githubProfile: {
            select: { summary: true, languages: true },
          },
        },
      },
      turns: {
        orderBy: { orderNumber: "asc" },
        select: {
          id: true,
          orderNumber: true,
          questionText: true,
          answerText: true,
        },
      },
    },
  });

  if (!interview) {
    console.warn(`[evaluation] interview ${interviewId} not found`);
    return { error: "Interview not found" };
  }
  if (interview.turns.length === 0) {
    console.warn(
      `[evaluation] interview ${interviewId} has no turns — skipping`,
    );
    const prompt = buildEvaluationPrompt({
      position: interview.position,
      candidateName: interview.user.name,
      resumeText: interview.resume?.extractedText ?? null,
      githubSummary: null,
      githubLanguages: [],
      turns: [],
      liveAssessments: liveData?.liveAssessments,
      interruptionCount: liveData?.interruptionCount,
      runtime: liveData?.runtime,
      deterministic: liveData?.deterministic,
    });

    // Still generate a basic evaluation even with no turns
    const result = await generateEvaluation(prompt);
    if (result) {
      await writeEvaluation(
        interviewId,
        {
          startedAt: interview.startedAt,
          endedAt: interview.endedAt,
        },
        interview.turns,
        result,
      );
    }
    return { evaluation: result, summary: null };
  }

  const github = interview.user.githubProfile;

  const prompt = buildEvaluationPrompt({
    position: interview.position,
    candidateName: interview.user.name,
    resumeText: interview.resume?.extractedText ?? null,
    githubSummary: github?.summary ?? null,
    githubLanguages: (github?.languages as string[]) ?? [],
    turns: interview.turns,
    liveAssessments: liveData?.liveAssessments,
    interruptionCount: liveData?.interruptionCount,
    runtime: liveData?.runtime,
    deterministic: liveData?.deterministic,
  });

  const result = await generateEvaluation(prompt);
  if (!result) throw new Error("Evaluation failed — no response from Gemini");

  await writeEvaluation(
    interviewId,
    {
      startedAt: interview.startedAt,
      endedAt: interview.endedAt,
    },
    interview.turns,
    result,
  );

  return { evaluation: result, summary: null };
}

// ── DSA Evaluation ──

interface DsaEvaluationResult {
  overallScore: number;
  summary: string;
  keyStrengths: string[];
  areasForImprovement: string[];
  attempts: Array<{
    index: number;
    score: number;
    feedback: string;
    complexity: string;
    strengths: string[];
    weaknesses: string[];
  }>;
}

const DSA_EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Overall DSA score 0-100 weighted across questions",
    },
    summary: { type: "string", description: "Overall DSA performance summary" },
    keyStrengths: {
      type: "array",
      items: { type: "string" },
      description: "Top 3-5 strengths",
    },
    areasForImprovement: {
      type: "array",
      items: { type: "string" },
      description: "Top 3-5 areas to improve",
    },
    attempts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" },
          score: { type: "number", description: "Score 0-100" },
          feedback: {
            type: "string",
            description: "Detailed evaluation feedback",
          },
          complexity: {
            type: "string",
            description: "Time and space complexity achieved",
          },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
        },
        required: [
          "index",
          "score",
          "feedback",
          "complexity",
          "strengths",
          "weaknesses",
        ],
      },
    },
  },
  required: ["overallScore", "summary", "keyStrengths", "areasForImprovement"],
};

async function generateDsaEvaluation(
  prompt: string,
): Promise<DsaEvaluationResult | null> {
  const apiKey = Bun.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY env not set");

  const ai = new GoogleGenAI({ apiKey });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: DSA_EVALUATION_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) {
        console.warn(`[dsa-evaluate] empty response, attempt ${attempt + 1}`);
        throw new Error("No response from Gemini");
      }

      return JSON.parse(text) as DsaEvaluationResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[dsa-evaluate] attempt ${attempt + 1}/2 failed: ${message}`,
      );
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  return null;
}

export async function evaluateDsaSession(
  interviewId: string,
  liveAssessments?: LiveAssessment[],
  interruptionCount?: number,
  runtime?: Pick<
    InterviewerRuntime,
    | "notes"
    | "simplifiedQuestions"
    | "followUps"
    | "recoveryEvents"
    | "overconfidenceDetected"
    | "constraints"
  >,
  deterministic?: DeterministicState,
) {
  try {
    const dsaSession = await prisma.dsaSession.findUnique({
      where: { interviewId },
      include: {
        problems: { orderBy: { index: "asc" } },
      },
    });

    if (!dsaSession) {
      console.warn(
        `[dsa-evaluate] no DSA session for interview ${interviewId}`,
      );
      return;
    }

    if (dsaSession.status === "EVALUATED") return;

    const problems = dsaSession.problems;
    const problemBlocks = problems
      .map((p, i) => `Question ${i + 1}: ${p.title} (${p.difficulty})`)
      .join("\n");

    const attemptBlocks = problems
      .map(
        (p) =>
          `Attempt ${p.index + 1}:
- Phases completed: ${p.phasesCompleted.join(", ") || "none"}
- Time taken: ${p.timeTaken ? `${p.timeTaken}s` : "N/A"}
- Code: ${p.code ? `\`\`\`\n${p.code.slice(0, 2000)}\n\`\`\`` : "No code submitted"}`,
      )
      .join("\n\n");

    const problemCount = problems.length;
    const liveBlock = buildLiveObservationsBlock(
      liveAssessments,
      interruptionCount,
    );

    const runtimeBlock = buildRuntimeBlock(runtime, liveAssessments);

    const deterministicBlock = buildDeterministicContextBlock(deterministic);

    const prompt = `Evaluate the candidate's DSA coding interview performance.

## Questions
${problemBlocks}

## Attempts
${attemptBlocks}

## Evaluation Criteria
Score each question 0-100 based on:
- **Problem Understanding** (20%): Did they clarify requirements and edge cases?
- **Approach** (25%): Did they discuss brute force and optimize?
- **Implementation** (30%): Did they write correct, clean code?
- **Testing** (10%): Did they verify with test cases?
- **Communication** (15%): Did they explain their thinking clearly?

## Inter-Question Consistency
${problemCount > 1 ? "Compare approach quality across questions. Does the candidate show consistent problem-solving skill, or do they excel on easy problems but struggle on harder ones? Note any patterns in the overall summary." : "Only one question attempted — consistency cross-check is N/A."}

## Accuracy Calibration
Calibrate scores by difficulty: a correct easy solution should score lower than a correct hard solution. Consider time taken relative to expected benchmark. Reward optimal (not just correct) solutions with higher scores.

## Behavioral Signals
Infer candidate state from their responses: do they dive into edge cases confidently or wait to be prompted? Do they backtrack or correct themselves? Factor observed confidence and clarity into the Communication (15%) score.

${liveBlock}

${runtimeBlock}

${deterministicBlock}

Provide specific, actionable feedback for each question. Return ONLY valid JSON matching the schema.`;

    const result = await generateDsaEvaluation(prompt);
    if (!result) {
      console.error(
        `[dsa-evaluate] evaluation failed for interview ${interviewId}`,
      );
      return;
    }

    // Update each problem with score and feedback
    await Promise.all(
      result.attempts.map((a) =>
        prisma.dsaProblem.updateMany({
          where: { dsaSessionId: dsaSession.id, index: a.index },
          data: {
            score: a.score,
            feedback: a.feedback,
            complexity: a.complexity,
          },
        }),
      ),
    );

    // Update session with overall score and mark as evaluated
    await prisma.dsaSession.update({
      where: { id: dsaSession.id },
      data: {
        status: "EVALUATED",
      },
    });

    // Store overall scores on the interview session
    await prisma.interviewSession.update({
      where: { id: interviewId },
      data: {
        overallScore: result.overallScore,
        technicalScore: result.overallScore,
        problemSolvingScore: result.overallScore,
      },
    });

    console.log(
      `[dsa-evaluate] completed for interview ${interviewId}: ${result.overallScore}/100`,
    );
  } catch (err) {
    console.error(`[dsa-evaluate] error:`, err);
  }
}

// ── System Design Evaluation ──

const SYSTEM_DESIGN_EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Overall system design score 0-100",
    },
    dimensions: {
      type: "object",
      properties: {
        requirementsGathering: { type: "number", description: "0-100" },
        estimation: { type: "number", description: "0-100" },
        highLevelArchitecture: { type: "number", description: "0-100" },
        dataModel: { type: "number", description: "0-100" },
        scalability: { type: "number", description: "0-100" },
        faultTolerance: { type: "number", description: "0-100" },
        tradeoffsAndDepth: { type: "number", description: "0-100" },
      },
      required: [
        "requirementsGathering",
        "estimation",
        "highLevelArchitecture",
        "dataModel",
        "scalability",
        "faultTolerance",
        "tradeoffsAndDepth",
      ],
    },
    canvasFeedback: {
      type: "object",
      properties: {
        missingComponents: {
          type: "array",
          items: { type: "string" },
        },
        strongDecisions: {
          type: "array",
          items: { type: "string" },
        },
        weakDecisions: {
          type: "array",
          items: { type: "string" },
        },
        overallDiagramQuality: { type: "string" },
      },
      required: [
        "missingComponents",
        "strongDecisions",
        "weakDecisions",
        "overallDiagramQuality",
      ],
    },
    graphHistoryInsights: {
      type: "object",
      properties: {
        architectureEvolution: { type: "string" },
        patternStrengths: {
          type: "array",
          items: { type: "string" },
        },
        patternWeaknesses: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "architectureEvolution",
        "patternStrengths",
        "patternWeaknesses",
      ],
    },
    summary: { type: "string" },
    improvements: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "overallScore",
    "dimensions",
    "canvasFeedback",
    "graphHistoryInsights",
    "summary",
    "improvements",
  ],
} as const;

interface SystemDesignEvaluationResult {
  overallScore: number;
  dimensions: {
    requirementsGathering: number;
    estimation: number;
    highLevelArchitecture: number;
    dataModel: number;
    scalability: number;
    faultTolerance: number;
    tradeoffsAndDepth: number;
  };
  canvasFeedback: {
    missingComponents: string[];
    strongDecisions: string[];
    weakDecisions: string[];
    overallDiagramQuality: string;
  };
  graphHistoryInsights: {
    architectureEvolution: string;
    patternStrengths: string[];
    patternWeaknesses: string[];
  };
  summary: string;
  improvements: string[];
}

async function generateSystemDesignEvaluation(
  prompt: string,
): Promise<SystemDesignEvaluationResult | null> {
  const apiKey = Bun.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY env not set");

  const ai = new GoogleGenAI({ apiKey });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: SYSTEM_DESIGN_EVALUATION_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response from Gemini");
      }

      return JSON.parse(text) as SystemDesignEvaluationResult;
    } catch {
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  return null;
}

export async function evaluateSystemDesignSession(
  interviewId: string,
  liveAssessments?: LiveAssessment[],
  interruptionCount?: number,
  runtime?: Pick<
    InterviewerRuntime,
    | "notes"
    | "simplifiedQuestions"
    | "followUps"
    | "recoveryEvents"
    | "overconfidenceDetected"
    | "constraints"
  >,
  deterministic?: DeterministicState,
) {
  try {
    const interview = await prisma.interviewSession.findUnique({
      where: { id: interviewId },
      include: {
        user: { select: { name: true } },
        turns: { orderBy: { orderNumber: "asc" } },
      },
    });

    if (!interview) {
      return;
    }

    // Filter AI-origin nodes from graph history for evolution analysis
    const rawGraphHistory = (interview as Record<string, unknown>)
      .canvasGraphHistory;
    const graphHistory = Array.isArray(rawGraphHistory) ? rawGraphHistory : [];
    const userOnlyHistory = graphHistory.map((snapshot: unknown) => {
      const s = snapshot as { nodes?: { origin?: string }[] };
      if (!s.nodes) return snapshot;
      return {
        ...s,
        nodes: s.nodes.filter((n) => n.origin !== "ai"),
      };
    });

    const transcript = interview.turns
      .map(
        (t) =>
          `[Q${t.orderNumber}]: ${t.questionText}\n[A${t.orderNumber}]: ${t.answerText}`,
      )
      .join("\n\n");

    const turnCount = interview.turns.length;
    const liveBlock = buildLiveObservationsBlock(
      liveAssessments,
      interruptionCount,
    );

    const runtimeBlock = buildRuntimeBlock(runtime, liveAssessments);

    const deterministicBlock = buildDeterministicContextBlock(deterministic);

    const prompt = `Evaluate the candidate's system design interview performance.

## Transcript
${transcript || "No transcript available."}

## Architecture Evolution (user contributions only, AI suggestions excluded)
${JSON.stringify(userOnlyHistory.slice(-10))}

## Final Diagram
${JSON.stringify((interview as { finalDiagram?: unknown }).finalDiagram ?? "No final diagram")}

## Evaluation Criteria
Score each dimension 0-100 based on observed evidence:
- **Requirements Gathering**: Did they clarify scope, constraints, and assumptions?
- **Estimation**: Did they estimate traffic, storage, bandwidth, and cache requirements?
- **High-Level Architecture**: Overall structure, component choices, and interactions
- **Data Model**: Schema design, storage technology choices, indexing strategy
- **Scalability**: Handling growth, sharding, replication, CDN, caching layers
- **Fault Tolerance**: Redundancy, failover, disaster recovery, graceful degradation
- **Tradeoffs & Depth**: Awareness of alternatives, informed decision-making, depth of reasoning

## Inter-Question Consistency
${turnCount > 1 ? "Check for contradictions in the candidate's design reasoning across questions. Do they mention a pattern early but contradict it later? Consistency in design philosophy across different problems is a positive signal." : "Only one topic discussed — consistency check is N/A."}

## Accuracy Calibration
Calibrate scores against seniority level: juniors are not expected to dive deep into multi-region replication, while seniors should. Reward candidates who proactively identify tradeoffs rather than waiting to be prompted.

## Behavioral Signals
Infer candidate state from the transcript: confidence in design choices, comfort with ambiguity, ability to accept redirections. Factor these into the overall score — a candidate who owns their design decisions and clearly articulates tradeoffs demonstrates senior-level communication.

${liveBlock}

${runtimeBlock}

${deterministicBlock}

## Canvas Feedback
Analyze the final diagram. What's missing? What strong decisions were made? What weak decisions?
Rate the overall diagram quality.

## Graph History Insights
How did the architecture evolve? (AI-suggested nodes are excluded — only user's own decisions.)
What patterns (strengths and weaknesses) appear across the timeline?

Return ONLY valid JSON matching the schema.`;

    const result = await generateSystemDesignEvaluation(prompt);
    if (!result) {
      return;
    }

    await prisma.$transaction([
      prisma.interviewSession.update({
        where: { id: interviewId },
        data: {
          overallScore: result.overallScore,
          technicalScore: Math.round(
            (result.dimensions.highLevelArchitecture +
              result.dimensions.dataModel +
              result.dimensions.scalability +
              result.dimensions.faultTolerance +
              result.dimensions.tradeoffsAndDepth) /
              5,
          ),
          problemSolvingScore: Math.round(
            (result.dimensions.requirementsGathering +
              result.dimensions.estimation +
              result.dimensions.highLevelArchitecture) /
              3,
          ),
        },
      }),
      prisma.interviewSummary.upsert({
        where: { interviewId },
        create: {
          interviewId,
          summary: result.summary,
          strengths: result.canvasFeedback.strongDecisions,
          weaknesses: result.canvasFeedback.weakDecisions,
          improvementAreas: result.improvements,
          recommendedTopics: [],
          resumeStrengths: [],
          resumeWeaknesses: [],
        },
        update: {
          summary: result.summary,
          strengths: result.canvasFeedback.strongDecisions,
          weaknesses: result.canvasFeedback.weakDecisions,
          improvementAreas: result.improvements,
          recommendedTopics: [],
          resumeStrengths: [],
          resumeWeaknesses: [],
        },
      }),
    ]);
  } catch (err) {
    console.error(`[sd-evaluate] error for interview ${interviewId}:`, err);
  }
}
