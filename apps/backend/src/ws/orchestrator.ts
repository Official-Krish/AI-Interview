import { jwtVerify } from "jose";
import { createGeminiSession } from "../gemini";
import { prisma } from "../lib/prisma";
import { dedupAppend } from "./dedup";
import { handleDsaMarkers } from "./helpers/dsa-markers";
import { handleSdMarkers, resetSdCounters } from "./helpers/sd-markers";
import {
  isNewQuestion,
  flushChallengeTurn,
  isChallengeMode,
} from "./helpers/turn";
import {
  initiateClosing,
  handleTurnCompleteDuringClosing,
} from "./helpers/cleanup";
import { resetSilenceState, startSilenceTimer } from "./helpers/silence";
import type { InterviewConnection } from "./session";
import { functionHandlers, safeIndex } from "./tools";
const SECRET = Bun.env.JWT_SECRET;
const encoder = new TextEncoder();

export async function verifyWsToken(
  token: string,
): Promise<{ id: string; email: string } | null> {
  if (!SECRET) return null;
  try {
    const key = encoder.encode(SECRET);
    const { payload } = await jwtVerify(token, key);
    if (typeof payload.id === "string" && typeof payload.email === "string") {
      return { id: payload.id, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

const UNIVERSAL_TOOLS = [
  "assessTurn",
  "showReaction",
  "takeNote",
  "markForFollowUp",
  "updateInterviewPace",
  "allDone",
];

const MODE_TOOLS: Record<string, string[]> = {
  DSA: [
    ...UNIVERSAL_TOOLS,
    "updateCandidateCode",
    "advanceToNextQuestion",
    "simplifyQuestion",
    "scoreTurn",
  ],
  SYSTEM_DESIGN: [
    ...UNIVERSAL_TOOLS,
    "canvasDiff",
    "canvasExample",
    "advanceStage",
    "advanceCanvasQuestion",
    "requestCanvasFocus",
    "changeConstraint",
    "challengeCandidate",
    "simplifyQuestion",
    "scoreTurn",
  ],
  DISCUSSION: [
    ...UNIVERSAL_TOOLS,
    "challengeCandidate",
    "simplifyQuestion",
    "scoreTurn",
  ],
};

function enabledToolNamesForConnection(conn: InterviewConnection) {
  if (conn.isDsaMode) return MODE_TOOLS.DSA;
  if (conn.isSystemDesign) return MODE_TOOLS.SYSTEM_DESIGN;
  if (conn.isDiscussionMode) return MODE_TOOLS.DISCUSSION;
  return UNIVERSAL_TOOLS;
}

// ── Orchestrator ──

// Strip control characters and ASR artifacts from model output
function stripCtrl(s: string): string {
  return s
    .replace(/<\/?ctrl\d+>/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function startInterview(
  conn: InterviewConnection,
  systemPrompt: string,
  timeLimitMs: number,
) {
  conn.isQueued = false;
  console.log(
    "[orchestrator] startInterview, isSystemDesign:",
    conn.isSystemDesign,
  );
  await prisma.interviewSession.update({
    where: { id: conn.interviewId! },
    data: { status: "ACTIVE", startedAt: new Date() },
  });

  // Build greeting instruction — sent as a clientContent turn to trigger
  // the model's first response. This is the approach used in production.
  let greeting: string;
  if (conn.isDsaMode) {
    greeting =
      "Start the DSA coding interview. Say you're their interviewer for the day. Mention the role and company they're interviewing for. Tell the candidate their first coding problem is displayed on the right side of their screen. Ask them to take a moment to read it and let you know when they're ready. Then STOP — wait for their response. Do NOT discuss the problem or ask any technical questions until they confirm they're ready. Do not use a name or introduce yourself personally — just say you're their interviewer.";
  } else if (conn.isDiscussionMode) {
    greeting =
      "Start the case study discussion. Greet the candidate naturally. Say you are their interviewer for the day and mention the role and company. No name. Tell them the case study is displayed on the right side of their screen. Ask them to read it and let you know when they are ready. Then STOP and wait. Do NOT discuss the case until they confirm they are ready.";
  } else {
    greeting =
      "Start the interview. Greet the candidate naturally. Say you are their interviewer for the day and mention the role and company they are interviewing for. No name. Then ask your first question.";
  }

  try {
    const enabledToolNames = enabledToolNamesForConnection(conn);
    console.log(
      "[gemini] enabled tools:",
      enabledToolNames === undefined ? "all" : enabledToolNames.length,
    );
    conn.gemini = await createGeminiSession(systemPrompt, enabledToolNames);
    if (conn.isSystemDesign) {
      console.log("[orchestrator] resetting SD counters");
      resetSdCounters(conn);
    }
  } catch (err) {
    console.error("[ws] Gemini session failed:", err);
    await conn.safeSend({
      error: "Failed to connect to AI. Please try again.",
    });
    return;
  }

  // Send greeting as clientContent turn to trigger model's first response
  console.log("[ws] sending initial clientContent greeting...");
  try {
    conn.gemini.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [{ text: greeting }],
            },
          ],
          turnComplete: true,
        },
      }),
    );
  } catch (err) {
    console.error("[ws] greeting send failed:", err);
  }

  conn.gemini.on("message", async (event) => {
    try {
      const data = event instanceof Buffer ? event.toString() : String(event);

      try {
        const parsed = JSON.parse(data);

        if (parsed.error) {
          console.error("[gemini] ERROR:", JSON.stringify(parsed.error));
        }

        const hasContent = !!parsed.serverContent;
        const hasSetup = !!parsed.setupComplete;
        if (hasContent || hasSetup) {
          const label = hasSetup ? "setupComplete" : "serverContent";
          const hasAudio = !!parsed.serverContent?.modelTurn?.parts?.some(
            (p: Record<string, unknown>) => p.inlineData,
          );
          const hasText = !!parsed.serverContent?.modelTurn?.parts?.some(
            (p: Record<string, unknown>) => typeof p.text === "string",
          );
          const hasFnCall = !!parsed.serverContent?.modelTurn?.parts?.some(
            (p: Record<string, unknown>) => p.functionCall,
          );
          const tc = !!parsed.serverContent?.turnComplete;
          // Only log non-audio-only messages to reduce noise
          if (
            hasText ||
            hasFnCall ||
            tc ||
            hasSetup ||
            parsed.serverContent?.outputTranscription ||
            parsed.serverContent?.inputTranscription
          ) {
            console.log(
              `[gemini] → ${label}${hasAudio ? " (with audio)" : ""} turnComplete=${tc}`,
            );
          }

          // Relay serverContent to client (but not setupComplete)
        } else if (!parsed.setupComplete) {
          const sanitized = { ...parsed };
          if (
            typeof sanitized.clientContent === "object" &&
            sanitized.clientContent
          ) {
            (sanitized.clientContent as Record<string, unknown>).turns =
              "[redacted]";
          }
          if (sanitized.realtimeInput) {
            sanitized.realtimeInput = "[redacted]";
          }
          console.log(
            "[gemini] \u2192 other message:",
            JSON.stringify(sanitized).slice(0, 300),
          );
        }

        if (!parsed.setupComplete) {
          // When generationComplete arrives without turnComplete, inject turnComplete
          // so the frontend knows the AI finished speaking.
          if (
            parsed.serverContent?.generationComplete === true &&
            parsed.serverContent?.turnComplete !== true
          ) {
            const enhanced = {
              ...parsed,
              serverContent: {
                ...parsed.serverContent,
                turnComplete: true,
              },
            };
            await conn.safeSendRaw(JSON.stringify(enhanced));
          } else {
            await conn.safeSendRaw(data);
          }
        }

        const inputText = parsed.serverContent?.inputTranscription?.text;
        const outputText = stripCtrl(
          parsed.serverContent?.outputTranscription?.text ?? "",
        );

        // Also grab raw text from modelTurn.parts
        const rawText = stripCtrl(
          parsed.serverContent?.modelTurn?.parts
            ?.filter((p: Record<string, unknown>) => typeof p.text === "string")
            .map((p: Record<string, unknown>) => p.text as string)
            .join(" ") ?? "",
        );

        // Accumulate raw text for fallback marker extraction
        const markerText =
          ((conn.isDsaMode || conn.isSystemDesign) && rawText) || outputText;

        // Accumulate clean spoken text for DB storage
        const cleanText = outputText || rawText;

        if (markerText && conn.interviewId) {
          conn.questionBuf = dedupAppend(conn.questionBuf, markerText);
        }

        if (cleanText && conn.interviewId) {
          conn.cleanQuestionBuf = dedupAppend(conn.cleanQuestionBuf, cleanText);
        }

        if (inputText && conn.interviewId) {
          conn.answerBuf = dedupAppend(conn.answerBuf, inputText);
        }

        const turnComplete = parsed.serverContent?.turnComplete === true;
        const generationComplete =
          parsed.serverContent?.generationComplete === true;
        const turnEnded = turnComplete || generationComplete;
        if (generationComplete && !turnComplete) {
          console.log(
            "[gemini] generationComplete without turnComplete — treating as turn end",
          );
        }

        // ── Function call handling (preferred path) ──
        const fnCalls: Array<Record<string, unknown>> = [];
        for (const part of parsed.serverContent?.modelTurn?.parts ?? []) {
          if (part.functionCall) fnCalls.push(part);
        }
        for (const call of parsed.toolCall?.functionCalls ?? []) {
          fnCalls.push({ functionCall: call });
        }

        // ── Tool call cancellation ──
        if (parsed.toolCallCancellation?.ids?.length > 0) {
          for (const id of parsed.toolCallCancellation.ids) {
            if (typeof id === "string") conn.canceledToolCallIds.add(id);
          }
          console.log(
            "[fn] tool call cancelled:",
            parsed.toolCallCancellation.ids,
          );
        }

        for (const part of fnCalls) {
          const fnCall = part.functionCall as {
            name?: string;
            args?: Record<string, unknown>;
            id?: string;
          };
          const { name, args, id: callId } = fnCall;
          if (!name) continue;
          if (callId && conn.canceledToolCallIds.has(callId)) {
            console.log(`[fn] skipping cancelled call: ${name}`);
            continue;
          }

          // Dedup: skip if same function + args already processed
          const hash = `${name}:${JSON.stringify(args ?? {})}`;
          if (hash === conn.lastFunctionHash) {
            console.log(`[fn] skipping duplicate: ${name}`);
            continue;
          }
          conn.lastFunctionHash = hash;

          const handler = functionHandlers[name];
          if (!handler) {
            console.error(`[fn] unknown function: ${name}`);
            continue;
          }

          // Validate
          const parsed = handler.schema.safeParse(args);
          if (!parsed.success) {
            console.error(`[fn] invalid args for ${name}:`, parsed.error);
            continue;
          }

          // Execute and await completion
          console.log(`[fn] executing: ${name}`);
          const result = await handler.handler(conn, parsed.data);
          // Fire-and-forget: tool executed, result stored locally, no toolResponse sent
          console.log(`[fn] completed: ${name}`, result);
        }

        // ── Fallback: text marker detection (preferred over function calls) ──
        if (fnCalls.length === 0) {
          // DSA/SQL mode: detect READY_FOR_NEXT / ALL_DONE / CODE_UPDATE
          if (
            turnComplete &&
            conn.isDsaMode &&
            !conn.isQuantMode &&
            !conn.dsaTransitioned
          ) {
            console.log(
              "[dsa] turnComplete, buf:",
              JSON.stringify(conn.questionBuf).slice(0, 200),
            );
            await handleDsaMarkers(conn);
          }

          // System Design mode: detect canvas_diff / canvas_example markers
          if (turnComplete && conn.isSystemDesign) {
            await handleSdMarkers(conn);
          }
        }

        // ── Parse stage and question markers (fallback) ──
        const markers = markerText || "";
        if (turnComplete && fnCalls.length === 0) {
          if (conn.pacing) {
            const stageMatch = markers.match(/\[STAGE:(\w+(?:-\w+)*)\]/);
            const stageName = stageMatch?.[1];
            if (stageName) {
              conn.pacing.advanceTo(stageName);
            }
          }

          const questionMatch = markers.match(/\[QUESTION:next\]/i);
          if (questionMatch && conn.isCanvasMode) {
            console.log("[orchestrator] [QUESTION:next] detected for canvas");
            conn.canvasQuestionIndex = safeIndex(conn.canvasQuestionIndex + 1);
            conn.safeSend({
              type: "canvas:next",
              questionIndex: conn.canvasQuestionIndex,
            });
          }
        }

        // Reset waitingForAiResponse when turn ends (turnComplete or generationComplete)
        if (turnEnded && conn.waitingForAiResponse && !conn.closingMode) {
          conn.waitingForAiResponse = false;

          if (conn.silencePromptActive) {
            conn.lastAudioTime = Date.now();
            conn.silencePromptActive = false;
          }

          if (isChallengeMode(conn) && isNewQuestion(conn, conn.questionBuf)) {
            await flushChallengeTurn(conn);
            conn.currentTurnId = null;
          }
        }

        if (conn.closingMode && turnEnded) {
          await handleTurnCompleteDuringClosing(conn);
        }
      } catch {
        // Not JSON or parse error — just relay
      }
    } catch (outerErr) {
      // Defense-in-depth: catch any error that escapes the inner try-catch
      // to prevent unhandled promise rejections from crashing the process
      console.error("[gemini] unhandled error in message handler:", outerErr);
    }
  });

  conn.gemini.on("close", async (...args: unknown[]) => {
    const code = args[0] as number | undefined;
    const reason = args[1] as string | undefined;
    if (!conn.finalized) {
      const retryableProviderClose =
        !conn.closingMode && (code === 1006 || code === 1007 || code === 1011);
      if (retryableProviderClose) {
        conn.safeSend({
          type: "error",
          code: "gemini_live_failed",
          message: "AI live session failed - please try again.",
        });
      }
      console.log(
        `[gemini] connection closed code=${code} reason="${reason}" - triggering cleanup`,
      );
      try {
        await conn.cleanup(
          retryableProviderClose ? "gemini_close_retryable" : "gemini_close",
        );
      } catch (cleanupErr) {
        console.error("[gemini] cleanup after close failed:", cleanupErr);
      }
    }
  });

  conn.gemini.on("error", async (err) => {
    console.error("[gemini] error:", err);
    try {
      await conn.safeSend({ error: "Gemini connection error" });
    } catch {
      // Client may already be disconnected
    }
  });

  // Start pacing timer (30s heartbeat)
  if (conn.pacing) {
    conn.pacingTimer = setInterval(() => {
      if (conn.gemini && conn.pacing) {
        const cs = conn.candidateState;
        const pacingMsg = conn.pacing.buildMessage(
          `n=${cs.nervousness},e=${cs.engagement},c=${cs.confidence},sig=${cs.currentSignal}`,
        );
        try {
          conn.gemini.send(
            JSON.stringify({
              realtimeInput: { text: pacingMsg },
            }),
          );
        } catch {
          // Non-critical
        }
      }
    }, 30_000);
  }

  console.log("[ws] sending ready signal to client");
  resetSilenceState(conn);
  startSilenceTimer(conn);
  await conn.safeSend({ type: "ready" });
  await conn.safeSend({ type: "time_limit", limitMs: timeLimitMs });

  conn.timeWarningTimer = setTimeout(
    () => {
      conn.safeSend({ type: "time_warning", remainingMs: 60_000 });
      if (conn.gemini) {
        try {
          conn.gemini.send(
            JSON.stringify({
              realtimeInput: {
                text: `[SYSTEM: 1 minute remaining. Wrap up current topic and begin closing. Do NOT start new discussions.]`,
              },
            }),
          );
        } catch {
          // Non-critical
        }
      }
    },
    Math.max(0, timeLimitMs - 60_000),
  );

  conn.timeCapTimer = setTimeout(() => {
    console.log("[ws] time cap reached — initiating closing");
    conn.safeSend({ type: "time_limit_reached" });
    initiateClosing(conn);
  }, timeLimitMs);
}
