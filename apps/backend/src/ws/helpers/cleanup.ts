import { removeFromQueue, releaseSlot } from "../../lib/queue";
import { prisma } from "../../lib/prisma";
import { finalizeInterview } from "../finalize";
import type { InterviewConnection } from "../session";
import { stopHeartbeat } from "./heartbeat";
import { clearCanvasQuestion } from "../../routes/canvas";
import { clearSdQuestion } from "../../routes/sd";
import {
  flushChallengeTurn,
  flushTurn,
  mergeAnswerBuf,
  isChallengeMode,
} from "./turn";
import { stopSilenceTimer } from "./silence";

export async function cleanup(conn: InterviewConnection, reason?: string) {
  try {
    stopHeartbeat(conn);
    stopSilenceTimer(conn);
    if (conn.pacingTimer) clearInterval(conn.pacingTimer);
    if (conn.timeWarningTimer) clearTimeout(conn.timeWarningTimer);
    if (conn.timeCapTimer) clearTimeout(conn.timeCapTimer);
    if (conn.canvasInactivityTimer) clearTimeout(conn.canvasInactivityTimer);

    if (conn.interviewId) {
      if (conn.isQueued) {
        console.log(
          `[ws] cleanup queued ${conn.interviewId} reason=${reason ?? "unknown"}`,
        );
        await removeFromQueue(conn.interviewId);
        conn.wsMap.delete(conn.interviewId);
        conn.startCallbacks.delete(conn.interviewId);
        await conn.onPositionUpdate();
      } else if (reason === "gemini_close_retryable" && !conn.finalized) {
        conn.finalized = true;
        console.warn(
          `[ws] Gemini closed during active interview ${conn.interviewId}; marking FAILED instead of evaluating`,
        );
        await prisma.interviewSession
          .update({
            where: { id: conn.interviewId },
            data: { status: "FAILED", endedAt: new Date() },
          })
          .catch((err) => {
            console.error("[ws] failed to mark interview FAILED:", err);
          });

        await releaseSlot(conn.interviewId);
        conn.wsMap.delete(conn.interviewId);
        conn.startCallbacks.delete(conn.interviewId);
        await conn.onDequeue();
      } else if (!conn.finalized) {
        conn.finalized = true;
        conn.cleaningSet.add(conn.interviewId);
        if (isChallengeMode(conn) && conn.currentTurnId) {
          await flushChallengeTurn(conn);
        } else if (conn.questionBuf) {
          await flushTurn(conn);
        } else if (conn.currentTurnId && conn.answerBuf) {
          await mergeAnswerBuf(conn);
        }

        await finalizeInterview(
          conn.interviewId,
          conn.liveAssessments,
          conn.interruptionCount,
          {
            notes: conn.runtime.notes,
            simplifiedQuestions: conn.runtime.simplifiedQuestions,
            followUps: conn.runtime.followUps,
            recoveryEvents: conn.runtime.recoveryEvents,
            overconfidenceDetected: conn.runtime.overconfidenceDetected,
            constraints: conn.runtime.constraints,
          },
          conn.deterministic,
        );

        await releaseSlot(conn.interviewId);
        conn.wsMap.delete(conn.interviewId);
        conn.startCallbacks.delete(conn.interviewId);
        conn.cleaningSet.delete(conn.interviewId);
        await conn.onDequeue();
      }
    }

    if (conn.interviewId) {
      clearCanvasQuestion(conn.interviewId);
      clearSdQuestion(conn.interviewId);
    }
    conn.gemini?.close();
  } catch (err) {
    if (conn.interviewId) {
      conn.cleaningSet.delete(conn.interviewId);
    }
    console.error(`[ws] cleanup error (reason=${reason ?? "unknown"}):`, err);
  }
}

export async function initiateClosing(conn: InterviewConnection) {
  if (conn.closingMode || conn.finalized) return;
  conn.closingMode = true;

  if (conn.timeWarningTimer) clearTimeout(conn.timeWarningTimer);
  if (conn.timeCapTimer) clearTimeout(conn.timeCapTimer);

  await conn.safeSend({ type: "closing_started" });

  try {
    conn.gemini?.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: "The interview is now complete. Give a brief closing summary highlighting one key strength and one area for improvement. Thank the candidate for interviewing with Evalio, and mention that this was an Evalio AI-powered practice interview. Invite them to share feedback about their experience. Then say goodbye.",
                },
              ],
            },
          ],
          turnComplete: true,
        },
      }),
    );
  } catch (err) {
    console.error("[ws] failed to send closing message to Gemini:", err);
  }

  setTimeout(() => {
    if (!conn.finalized) {
      console.log("[ws] closing safety timeout — forcing cleanup");
      cleanup(conn).catch((err) => {
        console.error("[ws] cleanup after safety timeout failed:", err);
      });
    }
  }, 120_000);
}

export async function handleTurnCompleteDuringClosing(
  conn: InterviewConnection,
) {
  if (!conn.interviewId || !conn.closingMode || conn.finalized) return;
  conn.finalized = true;
  console.log("[ws] closing turn complete — finalizing");

  try {
    if (isChallengeMode(conn) && conn.currentTurnId) {
      await flushChallengeTurn(conn);
    } else if (conn.questionBuf) {
      await flushTurn(conn);
    } else if (conn.currentTurnId && conn.answerBuf) {
      await mergeAnswerBuf(conn);
    }
    await finalizeInterview(
      conn.interviewId,
      conn.liveAssessments,
      conn.interruptionCount,
      {
        notes: conn.runtime.notes,
        simplifiedQuestions: conn.runtime.simplifiedQuestions,
        followUps: conn.runtime.followUps,
        recoveryEvents: conn.runtime.recoveryEvents,
        overconfidenceDetected: conn.runtime.overconfidenceDetected,
        constraints: conn.runtime.constraints,
      },
      conn.deterministic,
    );
    await conn.safeSend({ type: "feedback_ready" });
  } catch (err) {
    console.error("[ws] handleTurnCompleteDuringClosing error:", err);
  }

  try {
    conn.gemini?.close();
  } catch {
    /* already handled in adapter */
  }
  try {
    conn.client.close();
  } catch {
    /* client may already be disconnected */
  }
}
