import { z } from "zod";
import { prisma } from "../lib/prisma";
import { DSA_PHASES } from "@evalio/prompts";
import type { InterviewConnection } from "./session";
import { addScoredTurn, getMomentum, getRunningScore } from "./deterministic";

// ── Utility ──

export function safeIndex(n: unknown): number {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, 20);
}

export function safePhase(p: unknown): string {
  if (typeof p !== "string") return "implementation";
  return DSA_PHASES.includes(p as (typeof DSA_PHASES)[number])
    ? p
    : "implementation";
}

// ── Live Assessment type ──

export interface LiveAssessment {
  orderNumber: number;
  confidence: "low" | "medium" | "high";
  nervousness: "low" | "medium" | "high";
  engagement: "low" | "medium" | "high";
  clarity: "low" | "medium" | "high";
  fluency: "low" | "medium" | "high";
  signal: "none" | "strong" | "struggling" | "off_track" | "going_deep";
  hesitationLevel?: "low" | "medium" | "high";
  fillerLevel?: "low" | "medium" | "high";
  rationale: string;
}

// ── Zod validation schemas for function arguments ──

const UpdateCodeSchema = z.object({
  code: z.string(),
});

const AdvanceQuestionSchema = z.object({
  skipToIndex: z.number().int().optional(),
});

const AllDoneSchema = z.object({
  reason: z.string().optional(),
});

const CanvasDiffActionSchema = z.object({
  action: z.enum([
    "highlight",
    "add_node",
    "remove_node",
    "annotate",
    "clear_highlights",
  ]),
  nodeIds: z.array(z.string()).optional(),
  color: z.string().optional(),
  durationMs: z.number().optional(),
  id: z.string().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
});

const CanvasDiffSchema = z.object({
  actions: z.array(CanvasDiffActionSchema),
});

const CanvasExampleSchema = z.object({
  example: z.object({
    id: z.string(),
    title: z.string(),
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }),
});

const AdvanceStageSchema = z.object({
  stage: z.string(),
});

const AdvanceCanvasQuestionSchema = z.object({
  skipToIndex: z.number().int().optional(),
});

const AssessTurnSchema = z.object({
  nervousness: z.enum(["low", "medium", "high"]),
  confidence: z.enum(["low", "medium", "high"]),
  engagement: z.enum(["low", "medium", "high"]),
  clarity: z.enum(["low", "medium", "high"]),
  fluency: z.enum(["low", "medium", "high"]),
  signal: z.enum(["none", "strong", "struggling", "off_track", "going_deep"]),
  hesitationLevel: z.enum(["low", "medium", "high"]).optional(),
  fillerLevel: z.enum(["low", "medium", "high"]).optional(),
  rationale: z.string(),
});

export type AssessTurnArgs = z.infer<typeof AssessTurnSchema>;

// ── Phase 1 tools ──

const MarkForFollowUpSchema = z.object({
  topic: z.string().min(1).max(120),
  context: z.string().min(1).max(500),
});

const TakeNoteSchema = z.object({
  turn: z.number().int().min(0),
  note: z.string().min(1).max(500),
  severity: z.enum(["praise", "minor", "major"]),
  category: z.enum([
    "problem_solving",
    "communication",
    "technical",
    "leadership",
  ]),
});

const SimplifyQuestionSchema = z.object({
  reason: z.enum(["struggling", "time", "misunderstood"]),
  originalDifficulty: z.string().optional(),
});

// ── Phase 2 tools ──

const ShowReactionSchema = z.object({
  type: z.enum(["nod", "thinking", "impressed", "skeptical"]),
});

const RequestCanvasFocusSchema = z.object({
  nodeIds: z.array(z.string()).min(1).max(20),
  label: z.string().optional(),
});

const UpdateInterviewPaceSchema = z.object({
  pace: z.enum(["normal", "fast"]),
  reason: z.string().optional(),
});

// ── Phase 3 tools ──

const ChangeConstraintSchema = z.object({
  constraint: z.enum(["memory", "bandwidth", "latency", "storage", "users"]),
  value: z.string().min(1).max(120),
  revertAfterMs: z.number().int().min(1000).optional(),
});

const ChallengeCandidateSchema = z.object({
  topic: z.string().min(1).max(300),
});

// ── Phase 5 tools ──

const ScoreTurnSchema = z.object({
  turnNumber: z.number().int().min(0),
  score: z.number().min(0).max(100),
  weight: z.number().min(0.1).max(5.0).default(1.0),
  evidence: z.string().min(1).max(500),
});

// ── Function handler types ──

type FunctionResult = Record<string, unknown>;

interface FunctionHandler {
  schema: z.ZodType<unknown>;
  handler: (
    conn: InterviewConnection,
    args: unknown,
  ) => Promise<FunctionResult>;
}

// ── Function handlers ──

async function handleUpdateCandidateCode(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { code } = args as z.infer<typeof UpdateCodeSchema>;
  console.log("[fn] updateCandidateCode — updating editor");

  await conn.safeSend({ type: "dsa_code_update", code });

  try {
    const dsaSession = await prisma.dsaSession.findUnique({
      where: { interviewId: conn.interviewId! },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    if (dsaSession) {
      const problem = dsaSession.problems[dsaSession.currentIndex];
      if (problem) {
        const currentSnapshots = (problem.codeSnapshots ?? {}) as Record<
          string,
          string
        >;
        const currentPhase = problem.currentPhase;
        currentSnapshots[currentPhase] = code;
        await prisma.dsaProblem.update({
          where: { id: problem.id },
          data: {
            code,
            codeSnapshots: currentSnapshots,
          },
        });
      }
    }
  } catch (err) {
    console.error("[fn] updateCandidateCode — db persist failed:", err);
    return { success: false, error: "Failed to persist code" };
  }

  return { success: true };
}

async function handleAdvanceToNextQuestion(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { skipToIndex } = args as z.infer<typeof AdvanceQuestionSchema>;
  const skipIdx = skipToIndex != null ? Math.max(0, skipToIndex - 1) : null;

  if (conn.dsaTransitioned) {
    return { success: true, skipped: true, reason: "already transitioning" };
  }

  await conn.safeSend({ type: "dsa_ready_next", index: skipIdx });
  console.log(
    `[fn] advanceToNextQuestion — ${
      skipIdx != null ? `skip to Q${skipIdx + 1}` : "next question"
    }`,
  );

  try {
    const dsaSession = await prisma.dsaSession.findUnique({
      where: { interviewId: conn.interviewId! },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    if (dsaSession) {
      const nextIdx = skipIdx != null ? skipIdx : dsaSession.currentIndex + 1;
      const nextProblem = dsaSession.problems[nextIdx];
      if (nextProblem) {
        await prisma.dsaSession.update({
          where: { id: dsaSession.id },
          data: { currentIndex: nextIdx },
        });

        conn.gemini?.send(
          JSON.stringify({
            realtimeInput: {
              text:
                skipIdx != null
                  ? `[System] Skip ahead. The candidate is now on Question ${nextIdx + 1}: "${nextProblem.title}" (${nextProblem.difficulty}). Do NOT read it aloud — it's on their screen. Wait for them to indicate they've read it, then start with comprehension checks.`
                  : `[System] The interview has moved to the next question. The candidate is now on Question ${nextIdx + 1}: "${nextProblem.title}" (${nextProblem.difficulty}). Do NOT read the question aloud — it's displayed on their screen. Wait for the candidate to indicate they've read it before discussing. Start with comprehension checks.`,
            },
          }),
        );
      }
    }
  } catch (err) {
    console.error("[fn] advanceToNextQuestion — db update failed:", err);
    return { success: false, error: "Failed to advance question" };
  }

  conn.dsaTransitioned = true;
  return { success: true };
}

async function handleAllDone(
  conn: InterviewConnection,
  _args: unknown,
): Promise<FunctionResult> {
  if (conn.dsaTransitioned) {
    return { success: true, skipped: true, reason: "already transitioning" };
  }
  console.log("[fn] allDone");
  await conn.safeSend({ type: "dsa_all_done" });
  conn.dsaTransitioned = true;
  return { success: true };
}

async function handleCanvasDiff(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { actions } = args as z.infer<typeof CanvasDiffSchema>;
  const now = Date.now();
  const canSend =
    now - conn.lastCanvasDiffTime >= 15_000 && conn.canvasDiffCount < 50;

  if (!canSend) {
    return { success: false, error: "Rate limited", skipped: true };
  }

  await conn.safeSend({ type: "canvas_diff", actions });
  conn.canvasDiffCount++;
  conn.lastCanvasDiffTime = now;
  return { success: true };
}

async function handleCanvasExample(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { example } = args as z.infer<typeof CanvasExampleSchema>;
  const now = Date.now();
  const canSend =
    now - conn.lastCanvasExampleTime >= 60_000 && conn.canvasExampleCount < 5;

  if (!canSend) {
    return { success: false, error: "Rate limited", skipped: true };
  }

  await conn.safeSend({ type: "canvas_example", ...example });
  conn.canvasExampleCount++;
  conn.lastCanvasExampleTime = now;
  return { success: true };
}

async function handleAdvanceStage(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { stage } = args as z.infer<typeof AdvanceStageSchema>;
  if (conn.pacing) {
    conn.pacing.advanceTo(stage);
  }
  return { success: true };
}

async function handleAdvanceCanvasQuestion(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { skipToIndex } = args as z.infer<typeof AdvanceCanvasQuestionSchema>;
  const nextIndex =
    skipToIndex != null
      ? Math.max(0, skipToIndex - 1)
      : safeIndex(conn.canvasQuestionIndex + 1);

  conn.canvasQuestionIndex = nextIndex;
  await conn.safeSend({
    type: "canvas:next",
    questionIndex: nextIndex,
  });
  return { success: true };
}

async function handleAssessTurn(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const assessment = args as AssessTurnArgs;
  console.log(
    `[fn] assessTurn #${conn.liveAssessments.length + 1}: confidence=${assessment.confidence}, engagement=${assessment.engagement}, signal=${assessment.signal}`,
  );

  const prevConfidence = conn.candidateState.confidence;
  const prevSignal = conn.candidateState.currentSignal;

  // Persist assessment
  conn.liveAssessments.push({
    orderNumber: conn.nextOrderNumber,
    ...assessment,
  });

  // Update candidate state so [PACING] messages reflect latest observations
  conn.candidateState = {
    nervousness: assessment.nervousness,
    engagement: assessment.engagement,
    confidence: assessment.confidence,
    currentSignal: assessment.signal,
  };

  // ── Confidence trajectory (overconfidence detection) ──
  if (assessment.confidence === "high") {
    conn.runtime.highConfidenceStreak++;
    if (
      conn.runtime.highConfidenceStreak >= 3 &&
      !conn.runtime.overconfidenceDetected
    ) {
      conn.runtime.overconfidenceDetected = true;
      console.log(
        "[fn] assessTurn — overconfidence detected (3+ consecutive high)",
      );
    }
  } else {
    conn.runtime.highConfidenceStreak = 0;
  }

  // ── Recovery event detection ──
  const turn = conn.liveAssessments.length;
  if (
    prevConfidence === "low" &&
    (assessment.confidence === "medium" || assessment.confidence === "high")
  ) {
    conn.runtime.recoveryEvents.push({
      turn,
      type: "confidence_increase",
      description: `Confidence improved from ${prevConfidence} to ${assessment.confidence}.`,
    });
    console.log("[fn] assessTurn — recovery: confidence increase");
  }
  if (
    (prevSignal === "struggling" || prevSignal === "off_track") &&
    (assessment.signal === "strong" || assessment.signal === "going_deep")
  ) {
    conn.runtime.recoveryEvents.push({
      turn,
      type: "signal_improvement",
      description: `Signal improved from ${prevSignal} to ${assessment.signal}.`,
    });
    console.log("[fn] assessTurn — recovery: signal improvement");
  }

  return { success: true };
}

async function handleMarkForFollowUp(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { topic, context } = args as z.infer<typeof MarkForFollowUpSchema>;
  console.log(`[fn] markForFollowUp — topic="${topic}"`);
  conn.runtime.followUps.push({ topic, context, asked: false });
  return { success: true, queued: conn.runtime.followUps.length };
}

async function handleTakeNote(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { turn, note, severity, category } = args as z.infer<
    typeof TakeNoteSchema
  >;
  console.log(
    `[fn] takeNote — turn=${turn} severity=${severity} category=${category}`,
  );
  conn.runtime.notes.push({
    turn,
    note,
    severity,
    category,
    timestamp: Date.now(),
  });
  return { success: true, total: conn.runtime.notes.length };
}

const REACTION_COOLDOWN_MS = 10_000;

async function handleShowReaction(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { type } = args as z.infer<typeof ShowReactionSchema>;
  const now = Date.now();

  if (now - conn.runtime.reactionLastSentAt < REACTION_COOLDOWN_MS) {
    return { success: false, skipped: true, reason: "rate limited" };
  }

  conn.runtime.lastReaction = type;
  conn.runtime.reactionLastSentAt = now;
  await conn.safeSend({ type: "interviewer_reaction", reaction: type });
  return { success: true };
}

async function handleRequestCanvasFocus(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { nodeIds, label } = args as z.infer<typeof RequestCanvasFocusSchema>;
  console.log(`[fn] requestCanvasFocus — ${nodeIds.length} node(s)`);
  await conn.safeSend({ type: "canvas:focus", nodeIds, label: label ?? null });
  return { success: true };
}

async function handleUpdateInterviewPace(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { pace, reason } = args as z.infer<typeof UpdateInterviewPaceSchema>;
  conn.runtime.pace = pace;
  console.log(
    `[fn] updateInterviewPace — ${pace}${reason ? ` (${reason})` : ""}`,
  );

  // Notify Gemini of the pace change
  if (conn.gemini) {
    try {
      conn.gemini.send(
        JSON.stringify({
          realtimeInput: {
            text: `[PACING: ${pace === "fast" ? "Fast mode" : "Normal mode"}]${reason ? ` Reason: ${reason}` : ""}`,
          },
        }),
      );
    } catch {
      // Non-critical
    }
  }

  return { success: true };
}

async function handleChangeConstraint(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { constraint, value, revertAfterMs } = args as z.infer<
    typeof ChangeConstraintSchema
  >;
  console.log(`[fn] changeConstraint — ${constraint}=${value}`);

  conn.runtime.constraints.push({
    constraint,
    value,
    revertAfterMs,
    appliedAt: Date.now(),
  });

  // Inject constraint into Gemini context
  if (conn.gemini) {
    try {
      conn.gemini.send(
        JSON.stringify({
          realtimeInput: {
            text: `[CONSTRAINT] New constraint: ${constraint}=${value}.${revertAfterMs ? ` This constraint reverts in ${revertAfterMs}ms.` : ""} Acknowledge it and ask the candidate how they would adapt.`,
          },
        }),
      );
    } catch {
      // Non-critical
    }
  }

  // Auto-revert timer
  if (revertAfterMs) {
    setTimeout(() => {
      conn.runtime.constraints = conn.runtime.constraints.filter(
        (c) => c.appliedAt !== Date.now(),
      );
      if (conn.gemini) {
        try {
          conn.gemini.send(
            JSON.stringify({
              realtimeInput: {
                text: `[CONSTRAINT REVERTED] The constraint ${constraint}=${value} has been removed. The system is back to normal parameters.`,
              },
            }),
          );
        } catch {
          // Non-critical
        }
      }
    }, revertAfterMs);
  }

  return { success: true };
}

async function handleChallengeCandidate(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { topic } = args as z.infer<typeof ChallengeCandidateSchema>;
  conn.runtime.challengeCount++;
  console.log(
    `[fn] challengeCandidate #${conn.runtime.challengeCount} — topic="${topic.slice(0, 80)}"`,
  );

  if (conn.gemini) {
    try {
      conn.gemini.send(
        JSON.stringify({
          realtimeInput: {
            text: `[CHALLENGE] Push back on the candidate: ${topic}. Challenge their assumptions and ask them to defend their reasoning. This is a deliberate confidence check — probe for depth behind their assertiveness.`,
            completeTurn: true,
          },
        }),
      );
    } catch {
      // Non-critical
    }
  }

  return { success: true };
}

async function handleScoreTurn(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { turnNumber, score, weight, evidence } = args as z.infer<
    typeof ScoreTurnSchema
  >;
  console.log(`[fn] scoreTurn #${turnNumber}: score=${score} weight=${weight}`);

  addScoredTurn(conn.deterministic, { turnNumber, score, weight, evidence });
  const momentum = getMomentum(conn.deterministic);
  const running = getRunningScore(conn.deterministic);

  return {
    success: true,
    runningScore: running,
    momentum: momentum.direction,
    momentumSlope: Math.round(momentum.slope * 10) / 10,
  };
}

async function handleSimplifyQuestion(
  conn: InterviewConnection,
  args: unknown,
): Promise<FunctionResult> {
  const { reason, originalDifficulty } = args as z.infer<
    typeof SimplifyQuestionSchema
  >;
  const turn = conn.liveAssessments.length + 1;
  console.log(`[fn] simplifyQuestion — turn=${turn} reason=${reason}`);
  conn.runtime.simplifiedQuestions.push({
    turn,
    reason,
    originalDifficulty,
  });
  return { success: true };
}

// ── Handler registry ──

export const functionHandlers: Record<string, FunctionHandler> = {
  updateCandidateCode: {
    schema: UpdateCodeSchema,
    handler: handleUpdateCandidateCode,
  },
  advanceToNextQuestion: {
    schema: AdvanceQuestionSchema,
    handler: handleAdvanceToNextQuestion,
  },
  allDone: {
    schema: AllDoneSchema,
    handler: handleAllDone,
  },
  canvasDiff: {
    schema: CanvasDiffSchema,
    handler: handleCanvasDiff,
  },
  canvasExample: {
    schema: CanvasExampleSchema,
    handler: handleCanvasExample,
  },
  advanceStage: {
    schema: AdvanceStageSchema,
    handler: handleAdvanceStage,
  },
  advanceCanvasQuestion: {
    schema: AdvanceCanvasQuestionSchema,
    handler: handleAdvanceCanvasQuestion,
  },
  assessTurn: {
    schema: AssessTurnSchema,
    handler: handleAssessTurn,
  },
  markForFollowUp: {
    schema: MarkForFollowUpSchema,
    handler: handleMarkForFollowUp,
  },
  takeNote: {
    schema: TakeNoteSchema,
    handler: handleTakeNote,
  },
  simplifyQuestion: {
    schema: SimplifyQuestionSchema,
    handler: handleSimplifyQuestion,
  },
  showReaction: {
    schema: ShowReactionSchema,
    handler: handleShowReaction,
  },
  requestCanvasFocus: {
    schema: RequestCanvasFocusSchema,
    handler: handleRequestCanvasFocus,
  },
  updateInterviewPace: {
    schema: UpdateInterviewPaceSchema,
    handler: handleUpdateInterviewPace,
  },
  changeConstraint: {
    schema: ChangeConstraintSchema,
    handler: handleChangeConstraint,
  },
  challengeCandidate: {
    schema: ChallengeCandidateSchema,
    handler: handleChallengeCandidate,
  },
  scoreTurn: {
    schema: ScoreTurnSchema,
    handler: handleScoreTurn,
  },
};

// ── Function declarations for Gemini ──

export const FUNCTION_DECLARATIONS = [
  {
    name: "updateCandidateCode",
    description:
      "Update the candidate's code in the editor. Provide the FULL updated source code — it completely replaces whatever the candidate has in their editor. Call this to fix bugs, demonstrate a point, add inline comments as examples, show an alternative approach, or write test cases.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        code: {
          type: "STRING" as any,
          description:
            "The full updated source code that will replace the candidate's current code in the editor.",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "advanceToNextQuestion",
    description:
      "Signal that the current question has been sufficiently discussed and the interview should move to the next question. Optionally provide a 1-based question number to skip ahead (e.g., 3 to jump to the third question when the first was too easy). This replaces the READY_FOR_NEXT signal.",
    parameters: {
      type: "OBJECT",
      properties: {
        skipToIndex: {
          type: "INTEGER",
          description:
            "Optional 1-based question index to skip to (e.g., 3 to skip directly to question 3). Omit to advance by one.",
        },
      },
    },
  },
  {
    name: "allDone",
    description:
      "Signal that all questions have been completed and the interview should wrap up. Call this when time is nearly up or the candidate clearly cannot continue. This replaces the ALL_DONE signal.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: {
          type: "STRING",
          description:
            "Optional reason for ending (e.g., 'time_up', 'all_questions_done', 'candidate_stuck').",
        },
      },
    },
  },
  {
    name: "canvasDiff",
    description:
      "Apply additive modifications to the candidate's whiteboard canvas. Actions are additive — they never remove the candidate's work. Use to highlight specific nodes, add suggestion nodes (dashed border), place sticky-note annotations, or clear all highlights.",
    parameters: {
      type: "OBJECT",
      properties: {
        actions: {
          type: "ARRAY",
          description: "List of canvas actions to apply in sequence.",
          items: {
            type: "OBJECT",
            properties: {
              action: {
                type: "STRING",
                description: "The action to perform.",
                enum: [
                  "highlight",
                  "add_node",
                  "remove_node",
                  "annotate",
                  "clear_highlights",
                ],
              },
              nodeIds: {
                type: "ARRAY",
                description: "For highlight: node IDs to glow.",
                items: { type: "STRING" },
              },
              color: {
                type: "STRING",
                description: "For highlight: hex color (e.g., '#ef4444').",
              },
              durationMs: {
                type: "NUMBER",
                description: "For highlight: duration in milliseconds.",
              },
              id: {
                type: "STRING",
                description:
                  "For add_node/remove_node: unique node identifier.",
              },
              type: {
                type: "STRING",
                description:
                  "For add_node: the node type (service, storage, queue, cache, note).",
              },
              label: {
                type: "STRING",
                description: "For add_node: display label text.",
              },
              x: {
                type: "NUMBER",
                description: "For add_node: horizontal position.",
              },
              y: {
                type: "NUMBER",
                description: "For add_node: vertical position.",
              },
              text: {
                type: "STRING",
                description: "For annotate: sticky note content.",
              },
            },
            required: ["action"],
          },
        },
      },
      required: ["actions"],
    },
  },
  {
    name: "canvasExample",
    description:
      "Generate a reference architecture overlay when the candidate is completely stuck or explicitly asks for the 'right' answer. Opens as a separate overlay the candidate can toggle on/off — their own diagram is never replaced.",
    parameters: {
      type: "OBJECT",
      properties: {
        example: {
          type: "OBJECT",
          description: "The reference architecture payload.",
          properties: {
            id: {
              type: "STRING",
              description: "Unique reference identifier.",
            },
            title: {
              type: "STRING",
              description: "Title for the reference architecture overlay.",
            },
            nodes: {
              type: "ARRAY",
              description: "Node definitions for the reference architecture.",
              items: { type: "OBJECT" },
            },
            edges: {
              type: "ARRAY",
              description: "Edge definitions connecting the nodes.",
              items: { type: "OBJECT" },
            },
          },
          required: ["id", "title", "nodes", "edges"],
        },
      },
      required: ["example"],
    },
  },
  {
    name: "advanceStage",
    description:
      "Advance the interview pacing to a specific named stage. Use to track progress through structured interview stages (e.g., 'requirements', 'deep-dive', 'tradeoffs'). This replaces the [STAGE:...] text marker.",
    parameters: {
      type: "OBJECT",
      properties: {
        stage: {
          type: "STRING",
          description:
            "Stage name to advance to (e.g., 'deep-dive', 'requirements', 'tradeoffs').",
        },
      },
      required: ["stage"],
    },
  },
  {
    name: "advanceCanvasQuestion",
    description:
      "Advance to the next canvas question. Call this when the current question has been sufficiently discussed and the candidate's screen should update to show the next question. Optionally provide a 1-based question index to skip ahead. This replaces the [QUESTION:next] text marker.",
    parameters: {
      type: "OBJECT",
      properties: {
        skipToIndex: {
          type: "INTEGER",
          description:
            "Optional 1-based question index to skip to. Omit to advance by one.",
        },
      },
    },
  },
  {
    name: "assessTurn",
    description:
      "Record behavioral observations about the candidate's just-completed turn. Call this after EVERY candidate response, before asking the next question. Base your assessment primarily on observable delivery (confidence, hesitation, pacing, engagement, clarity) rather than answer correctness.",
    parameters: {
      type: "OBJECT",
      properties: {
        nervousness: {
          type: "STRING",
          enum: ["low", "medium", "high"],
          description: "How nervous did the candidate sound?",
        },
        confidence: {
          type: "STRING",
          enum: ["low", "medium", "high"],
          description: "How confident was their delivery?",
        },
        engagement: {
          type: "STRING",
          enum: ["low", "medium", "high"],
          description: "How engaged and present were they?",
        },
        clarity: {
          type: "STRING",
          enum: ["low", "medium", "high"],
          description: "How clearly did they structure their response?",
        },
        fluency: {
          type: "STRING",
          enum: ["low", "medium", "high"],
          description: "How fluent was their speech (pacing, flow)?",
        },
        signal: {
          type: "STRING",
          enum: ["none", "strong", "struggling", "off_track", "going_deep"],
          description: "Overall delivery signal for this turn.",
        },
        hesitationLevel: {
          type: "STRING",
          enum: ["low", "medium", "high"],
          description: "Level of hesitation or pausing.",
        },
        fillerLevel: {
          type: "STRING",
          enum: ["low", "medium", "high"],
          description: "Use of filler words (um, uh, like, you know).",
        },
        rationale: {
          type: "STRING",
          description:
            "Brief 1-sentence rationale describing what you observed.",
        },
      },
      required: [
        "nervousness",
        "confidence",
        "engagement",
        "clarity",
        "fluency",
        "signal",
        "rationale",
      ],
    },
  },
  {
    name: "markForFollowUp",
    description:
      "Remember a topic the candidate raised that you want to circle back to later. Call this when the candidate mentions something interesting that deserves follow-up, but you want to finish the current line of questioning first. The system will inject a follow-up question at a natural transition point.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        topic: {
          type: "STRING" as any,
          description: "The topic or claim to follow up on (max 120 chars).",
        },
        context: {
          type: "STRING" as any,
          description:
            "Brief context of what the candidate said, so the follow-up feels natural (max 500 chars).",
        },
      },
      required: ["topic", "context"],
    },
  },
  {
    name: "takeNote",
    description:
      "Record an observation about the candidate's performance. Use this to capture specific behaviors, strong moments, or concerns. Notes will appear in the final evaluation report so candidates understand the reasoning behind their scores.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        turn: {
          type: "INTEGER" as any,
          description:
            "The turn number this note refers to (use the current turn number).",
        },
        note: {
          type: "STRING" as any,
          description:
            "The observation text. Be specific and actionable (max 500 chars).",
        },
        severity: {
          type: "STRING" as any,
          enum: ["praise", "minor", "major"],
          description:
            "praise = positive observation, minor = small concern, major = significant issue.",
        },
        category: {
          type: "STRING" as any,
          enum: ["problem_solving", "communication", "technical", "leadership"],
          description: "Which skill area this note pertains to.",
        },
      },
      required: ["turn", "note", "severity", "category"],
    },
  },
  {
    name: "showReaction",
    description:
      "Show a subtle real-time facial reaction. Call this to make the interview feel more human. Use 'nod' when the candidate makes a valid point, 'thinking' when you're processing their response, 'impressed' when they exceed expectations, or 'skeptical' when their reasoning is questionable. Rate-limited to once per 10 seconds to avoid distraction.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        type: {
          type: "STRING" as any,
          enum: ["nod", "thinking", "impressed", "skeptical"],
          description:
            "The reaction to display: 'nod' (agreement/acknowledgment), 'thinking' (considering), 'impressed' (exceeded expectations), 'skeptical' (questionable reasoning).",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "requestCanvasFocus",
    description:
      "Ask the candidate to focus their attention on specific nodes on their whiteboard diagram. Use this to steer the conversation toward a particular part of the architecture during system design interviews. The specified nodes will briefly glow.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        nodeIds: {
          type: "ARRAY" as any,
          items: { type: "STRING" as any },
          description:
            "IDs of the canvas nodes to highlight (1-20 nodes). Use the node IDs from the canvas state.",
        },
        label: {
          type: "STRING" as any,
          description:
            "Optional label to display alongside the highlight (e.g., 'Let's focus on the database layer').",
        },
      },
      required: ["nodeIds"],
    },
  },
  {
    name: "updateInterviewPace",
    description:
      "Adjust the pace of the interview. Use 'fast' when time is running short or the candidate is spending too long on details. Use 'normal' to return to standard pace. The system will adjust silence thresholds — in fast mode, prompts come sooner. This replaces the old switchPersona approach.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        pace: {
          type: "STRING" as any,
          enum: ["normal", "fast"],
          description: "'fast' to compress timing, 'normal' for standard pace.",
        },
        reason: {
          type: "STRING" as any,
          description:
            "Optional reason for the pace change (e.g., '10 minutes remaining', 'candidate is verbose').",
        },
      },
      required: ["pace"],
    },
  },
  {
    name: "changeConstraint",
    description:
      "Introduce a new system design constraint mid-interview (e.g., memory limit, bandwidth cap, latency requirement, storage quota, user scale). This changes the problem parameters and tests the candidate's ability to adapt. The constraint is announced to the candidate and optionally auto-reverts after a duration.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        constraint: {
          type: "STRING" as any,
          enum: ["memory", "bandwidth", "latency", "storage", "users"],
          description:
            "The type of constraint to introduce: 'memory' (RAM limit), 'bandwidth' (network capacity), 'latency' (response time), 'storage' (data retention), 'users' (user scale).",
        },
        value: {
          type: "STRING" as any,
          description:
            "The constraint value (e.g., '512MB', '100ms p99', '10TB', '100M DAU').",
        },
        revertAfterMs: {
          type: "INTEGER" as any,
          description:
            "Optional. Milliseconds after which the constraint is automatically reverted. Use this for temporary constraints that test adaptation. Minimum 1000ms.",
        },
      },
      required: ["constraint", "value"],
    },
  },
  {
    name: "challengeCandidate",
    description:
      "Explicitly challenge the candidate's reasoning on a specific topic. Call this when the candidate seems overconfident, makes an unsupported claim, or you want to test the depth of their understanding. The system will push back and ask them to defend their position.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        topic: {
          type: "STRING" as any,
          description:
            "The specific claim or reasoning to challenge. Describe what the candidate said and why it needs deeper scrutiny (max 300 chars).",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "scoreTurn",
    description:
      "Score the candidate's just-completed turn. Call this AFTER assessTurn, before asking the next question. Provide a score and weight — the system computes a running weighted average. Weight reflects question importance: 0.5 for warm-up, 1.0 for standard, 2.0 for core/architecture, 2.5 for deep follow-ups. Evidence must explain what earned or lost points.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        turnNumber: {
          type: "INTEGER" as any,
          description: "The current turn number (1-based).",
        },
        score: {
          type: "NUMBER" as any,
          description: "Score for this turn 0-100.",
        },
        weight: {
          type: "NUMBER" as any,
          description:
            "Question importance weight. 0.5 = warm-up/generic, 1.0 = standard technical, 2.0 = core domain/architecture, 2.5 = deep follow-up/stress test. Defaults to 1.0.",
        },
        evidence: {
          type: "STRING" as any,
          description:
            "1-2 sentence explanation of what specifically earned or lost points. This appears on the results page so the candidate understands the score (max 500 chars).",
        },
      },
      required: ["turnNumber", "score", "evidence"],
    },
  },
  {
    name: "simplifyQuestion",
    description:
      "Indicate that the current question was simplified (because the candidate is struggling, time is running out, or they misunderstood). The evaluation system will adjust difficulty expectations accordingly — a candidate who recovers well after a simplification demonstrates resilience that should be rewarded, not penalized.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        reason: {
          type: "STRING" as any,
          enum: ["struggling", "time", "misunderstood"],
          description:
            "Why the question was simplified: 'struggling' = candidate is stuck, 'time' = running out of time, 'misunderstood' = candidate went in the wrong direction.",
        },
        originalDifficulty: {
          type: "STRING" as any,
          description:
            "Optional. The original difficulty level of the question before simplification (e.g., 'hard', 'medium').",
        },
      },
      required: ["reason"],
    },
  },
] as any;
