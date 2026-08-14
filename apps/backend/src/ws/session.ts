import { WebSocket as WsWebSocket } from "ws";
import type { GeminiSession } from "../gemini";
import { cleanup, initiateClosing } from "./helpers/cleanup";
import { safeIndex, safePhase, type LiveAssessment } from "./tools";
import { createDefaultRuntime, type InterviewerRuntime } from "./runtime";
import {
  createDeterministicState,
  type DeterministicState,
} from "./deterministic";
import { handleInit } from "./handlers/init";
import { handleAudioChunk, handleAudioStreamEnd } from "./handlers/audio";
import { prisma } from "../lib/prisma";
import type { PacingTracker } from "./helpers/pacing";

export interface CandidateState {
  nervousness: "low" | "medium" | "high";
  engagement: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  currentSignal: "none" | "struggling" | "going_deep" | "off_track" | "strong";
}

export type { LiveAssessment };

export class InterviewConnection {
  interviewId: string | null = null;
  gemini: GeminiSession | null = null;
  currentTurnId: string | null = null;
  questionBuf = "";
  cleanQuestionBuf = "";
  answerBuf = "";
  nextOrderNumber = 1;
  finalized = false;
  closingMode = false;
  timeWarningTimer: ReturnType<typeof setTimeout> | null = null;
  timeCapTimer: ReturnType<typeof setTimeout> | null = null;
  interviewDepth: string = "STANDARD";
  waitingForAiResponse = false;
  isQueued = false;
  isDsaMode = false;
  isSqlMode = false;
  isQuantMode = false;
  isHftMode = false;
  dsaTransitioned = false;
  candidateState: CandidateState = {
    nervousness: "low",
    engagement: "medium",
    confidence: "medium",
    currentSignal: "none",
  };
  isSystemDesign = false;
  isCanvasMode = false;
  canvasQuestionIndex = 0;
  isDiscussionMode = false;
  heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  pongTimeoutId: ReturnType<typeof setTimeout> | null = null;
  lastAudioTime = 0;
  audioChunksSinceLastTurn = 0;
  canvasInactivityTimer: ReturnType<typeof setTimeout> | null = null;

  // Canvas rate-limiting (per-connection to avoid cross-interview interference)
  canvasDiffCount = 0;
  canvasExampleCount = 0;
  lastCanvasDiffTime = 0;
  lastCanvasExampleTime = 0;

  // Silence detection
  silenceTimer: ReturnType<typeof setInterval> | null = null;
  lastCodePreviewTime = 0;
  lastCanvasSnapshotTime = 0;
  lastCanvasSnapshotData: unknown = null;
  silencePromptCount = 0;
  lastSilencePromptTime = 0;
  silencePromptActive = false;
  silenceTier: "standard" | "extended" | "design_critique" = "standard";

  // Live assessments
  liveAssessments: LiveAssessment[] = [];
  interruptionCount = 0;

  // Interviewer runtime state
  runtime: InterviewerRuntime = createDefaultRuntime();

  // Deterministic scoring state
  deterministic: DeterministicState = createDeterministicState();

  // Function calling
  lastFunctionHash: string | null = null; // dedup: hash of last function call name + args
  canceledToolCallIds = new Set<string>();

  // Pacing system
  pacing: PacingTracker | null = null;
  pacingTimer: ReturnType<typeof setInterval> | null = null;

  // Memory-aware runtime guidance (injected via silent realtimeInput)
  runtimeMemoryGuidance: string | null = null;

  // Rate limiter: max 20 WS messages per second per connection
  private messageTimestamps: number[] = [];
  private readonly MAX_WS_MSGS_PER_SEC = 20;

  private isRateLimited(): boolean {
    const now = Date.now();
    this.messageTimestamps = this.messageTimestamps.filter(
      (t) => now - t < 1000,
    );
    if (this.messageTimestamps.length >= this.MAX_WS_MSGS_PER_SEC) {
      return true;
    }
    this.messageTimestamps.push(now);
    return false;
  }

  constructor(
    readonly client: WsWebSocket,
    readonly wsMap: Map<string, WsWebSocket>,
    readonly startCallbacks: Map<string, () => Promise<void>>,
    readonly cleaningSet: Set<string>,
    readonly onDequeue: () => Promise<void>,
    readonly onPositionUpdate: () => Promise<void>,
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    const MAX_MESSAGE_SIZE = 1024 * 1024;

    this.client.on("message", async (raw) => {
      const rawData = raw instanceof Buffer ? raw : Buffer.from(raw.toString());
      if (rawData.length > MAX_MESSAGE_SIZE) {
        this.safeSend({ error: "Message too large" });
        this.client.close();
        return;
      }

      try {
        const msg = JSON.parse(rawData.toString());
        await this.handleMessage(msg);
      } catch (err) {
        // Log unexpected errors to prevent silent crashes
        if (err instanceof SyntaxError) {
          this.safeSend({ error: "Invalid JSON" });
        } else {
          console.error("[ws] error handling message:", err);
          this.safeSend({ error: "Internal error processing message" });
        }
      }
    });

    this.client.on("close", () => {
      console.log("[ws] candidate disconnected");
      cleanup(this).catch((err) => {
        console.error("[ws] cleanup on close failed:", err);
      });
    });

    this.client.on("error", (err) => {
      console.error("[ws] client error:", err);
      cleanup(this).catch((cleanupErr) => {
        console.error("[ws] cleanup on error failed:", cleanupErr);
      });
    });
  }

  async safeSend(data: unknown) {
    try {
      this.client.send(JSON.stringify(data));
    } catch {
      // Client already disconnected
    }
  }

  async safeSendRaw(data: string) {
    try {
      this.client.send(data);
    } catch {
      // Client already disconnected
    }
  }

  async cleanup(reason?: string) {
    await cleanup(this, reason);
  }

  private async handleMessage(msg: Record<string, unknown>) {
    if (msg.type !== "audio_chunk" && this.isRateLimited()) {
      this.safeSend({ error: "Too many messages. Slow down." });
      return;
    }

    switch (msg.type) {
      case "init":
        await handleInit(this, msg);
        break;

      case "audio_chunk":
        await handleAudioChunk(this, msg);
        break;

      case "audio_stream_end":
        await handleAudioStreamEnd(this, msg);
        break;

      case "code_preview": {
        if (!this.gemini || this.closingMode) return;
        this.lastCodePreviewTime = Date.now();
        const prevMsg = msg as {
          code?: string;
          language?: string;
          questionIndex?: number;
          phase?: string;
        };
        if (prevMsg.code === undefined || prevMsg.code.length > 100000) break;
        const idx = safeIndex(prevMsg.questionIndex);
        const phase = safePhase(prevMsg.phase);
        const effectiveLang = this.isHftMode
          ? "cpp"
          : (prevMsg.language ?? "javascript");
        this.gemini.send(
          JSON.stringify({
            realtimeInput: {
              text: `[Code Preview — Question ${idx}, ${phase} phase, not yet saved]\n\n\`\`\`${effectiveLang}\n${prevMsg.code}\n\`\`\``,
            },
          }),
        );
        break;
      }

      case "code_snapshot": {
        if (!this.gemini || this.closingMode) return;
        const codeMsg = msg as {
          code?: string;
          language?: string;
          questionIndex?: number;
          phase?: string;
        };
        if (codeMsg.code === undefined || codeMsg.code.length > 100000) break;
        const idx = safeIndex(codeMsg.questionIndex);
        const phase = safePhase(codeMsg.phase);
        const effectiveLang = this.isHftMode
          ? "cpp"
          : (codeMsg.language ?? "javascript");
        const codeText = `\`\`\`${effectiveLang}\n${codeMsg.code}\n\`\`\``;
        this.gemini.send(
          JSON.stringify({
            realtimeInput: {
              text: `[Code Snapshot for Question ${idx} during ${phase} phase]\n\n${codeText}`,
            },
          }),
        );

        if (this.interviewId) {
          try {
            const dsaSession = await prisma.dsaSession.findUnique({
              where: { interviewId: this.interviewId },
              include: { problems: { orderBy: { index: "asc" } } },
            });
            if (dsaSession && idx < dsaSession.problems.length) {
              const problem = dsaSession.problems[idx];
              if (problem) {
                const currentSnapshots = (problem.codeSnapshots ??
                  {}) as Record<string, string>;
                currentSnapshots[phase] = codeMsg.code;
                await prisma.dsaProblem.update({
                  where: { id: problem.id },
                  data: {
                    code: codeMsg.code,
                    codeSnapshots: currentSnapshots,
                  },
                });
              }
            }
          } catch {
            // Silently fail — code snapshot persistence is non-critical
          }
        }
        break;
      }

      case "phase_update": {
        if (this.closingMode) return;
        const phaseMsg = msg as { phase?: string; questionIndex?: number };
        if (this.gemini) {
          const idx = safeIndex(phaseMsg.questionIndex);
          this.gemini.send(
            JSON.stringify({
              realtimeInput: {
                text: `[Phase Update] Moving to "${safePhase(phaseMsg.phase)}" phase for question ${idx}.`,
              },
            }),
          );
        }
        break;
      }

      case "request_hint": {
        if (!this.gemini || this.closingMode || !this.isDsaMode) return;
        const hintMsg = msg as { questionIndex?: number };
        const idx = safeIndex(hintMsg.questionIndex);
        this.gemini.send(
          JSON.stringify({
            realtimeInput: {
              text: `[Hint Request] The candidate is asking for a hint on Question ${idx}. Provide a subtle hint that guides them toward the solution without giving it away. Use a Socratic approach — ask a leading question or point them toward the relevant data structure/algorithm to consider.`,
            },
          }),
        );
        break;
      }

      case "language_change": {
        if (!this.isDsaMode || !this.gemini) break;
        const langMsg = msg as { language?: string };
        const newLang = langMsg.language;
        if (!newLang) break;

        if (this.isHftMode) {
          console.log(
            `[hft] rejecting language change to "${newLang}" — HFT mode locks C++`,
          );
          this.safeSend({
            type: "language_change_rejected",
            language: "cpp",
            reason: "HFT coding mode is locked to C++",
          });
          break;
        }
        console.log(`[dsa] language change to "${newLang}"`);

        try {
          await prisma.dsaSession.update({
            where: { interviewId: this.interviewId! },
            data: { language: newLang },
          });

          this.gemini.send(
            JSON.stringify({
              realtimeInput: {
                text: `[Language Change] The candidate has switched to coding in **${newLang}**. Adjust your code review expectations and feedback accordingly. Be aware of ${newLang}-specific idioms, syntax, and conventions.`,
              },
            }),
          );
        } catch (err) {
          console.error("[dsa] failed to update language:", err);
        }
        break;
      }

      case "end_interview":
        console.log("[ws] end_interview from client");
        await initiateClosing(this);
        break;

      case "canvas_snapshot": {
        if (!this.gemini || this.closingMode || !this.isSystemDesign) {
          break;
        }
        this.lastCanvasSnapshotTime = Date.now();
        const canvasMsg = msg as { state?: unknown };
        if (!canvasMsg.state) {
          break;
        }
        this.lastCanvasSnapshotData = canvasMsg.state;

        try {
          await prisma.interviewSession.update({
            where: { id: this.interviewId! },
            data: {
              finalDiagram: canvasMsg.state,
              canvasGraphHistory: { push: canvasMsg.state },
            },
          });
        } catch (err) {
          console.error("[ws] failed to persist canvas snapshot:", err);
        }

        this.gemini.send(
          JSON.stringify({
            realtimeInput: {
              text: `[Canvas Snapshot]\n\n${JSON.stringify(canvasMsg.state)}`,
            },
          }),
        );

        // Auto-flush canvas-only silence: if the user is drawing without speaking,
        // send a turn complete after a delay so Gemini responds to the canvas state.
        if (!this.waitingForAiResponse) {
          const silenceMs = Date.now() - this.lastAudioTime;
          if (silenceMs > 8_000 && !this.canvasInactivityTimer) {
            this.canvasInactivityTimer = setTimeout(() => {
              this.canvasInactivityTimer = null;
              // If audio arrived while timer was pending, skip to avoid race
              if (Date.now() - this.lastAudioTime < 5_000) return;
              if (this.gemini && !this.closingMode && !this.finalized) {
                this.gemini.send(
                  JSON.stringify({
                    realtimeInput: { completeTurn: true },
                  }),
                );
                this.waitingForAiResponse = true;
              }
            }, 5_000);
          }
        }
        break;
      }

      default:
        await this.safeSend({
          error: `Unknown message type: ${msg.type}`,
        });
    }
  }
}
