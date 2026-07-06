import type { InterviewConnection } from "../session";
import {
  isChallengeMode,
  createTurn,
  flushTurn,
  mergeAnswerBuf,
} from "../helpers/turn";

const PCM_MIME_TYPE = "audio/pcm;rate=16000";
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function normalizePcmBase64(data: unknown) {
  if (typeof data !== "string" || data.length === 0) {
    return null;
  }

  if (data.length % 4 !== 0 || !BASE64_RE.test(data)) {
    return null;
  }

  const pcm = Buffer.from(data, "base64");
  if (pcm.length === 0 || pcm.length % 2 !== 0) {
    return null;
  }

  return {
    data: pcm.toString("base64"),
    byteLength: pcm.length,
    rms: calculateRms(pcm),
  };
}

function calculateRms(pcm: Buffer) {
  let sumSquares = 0;
  const sampleCount = pcm.length / 2;
  for (let offset = 0; offset < pcm.length; offset += 2) {
    const sample = pcm.readInt16LE(offset) / 0x8000;
    sumSquares += sample * sample;
  }
  return sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
}

export async function handleAudioChunk(
  conn: InterviewConnection,
  msg: Record<string, unknown>,
) {
  if (conn.closingMode || conn.finalized) return;
  if (!conn.gemini) {
    await conn.safeSend({
      error: "Not initialized. Send init first.",
    });
    return;
  }
  const normalized = normalizePcmBase64(msg.data);
  if (!normalized) {
    console.warn("[audio] dropping invalid PCM chunk");
    return;
  }

  conn.lastAudioTime = Date.now();
  conn.audioChunksSinceLastTurn++;

  // Enhanced logging for audio pipeline debugging
  if (conn.audioChunksSinceLastTurn <= 3) {
    console.log(
      `[audio] chunk #${conn.audioChunksSinceLastTurn} → Gemini (bytes=${normalized.byteLength}, rms=${normalized.rms.toFixed(5)}, waitingForAi=${conn.waitingForAiResponse})`,
    );
  } else if (conn.audioChunksSinceLastTurn % 10 === 0) {
    console.log(
      `[audio] chunk #${conn.audioChunksSinceLastTurn} (rms=${normalized.rms.toFixed(5)})`,
    );
  }

  if (conn.canvasInactivityTimer) {
    clearTimeout(conn.canvasInactivityTimer);
    conn.canvasInactivityTimer = null;
  }
  try {
    conn.gemini.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: PCM_MIME_TYPE,
              data: normalized.data,
            },
          ],
        },
      }),
    );
  } catch (err) {
    console.error(
      `[audio] failed to forward chunk #${conn.audioChunksSinceLastTurn}:`,
      err,
    );
    await conn.safeSend({ error: "Failed to send audio" });
  }
}

export async function handleAudioStreamEnd(
  conn: InterviewConnection,
  msg: Record<string, unknown>,
) {
  if (conn.closingMode || conn.finalized) return;
  if (!conn.gemini) {
    await conn.safeSend({
      error: "Not initialized. Send init first.",
    });
    return;
  }
  conn.lastAudioTime = Date.now();
  if (conn.canvasInactivityTimer) {
    clearTimeout(conn.canvasInactivityTimer);
    conn.canvasInactivityTimer = null;
  }

  const isInterrupted = (msg as { interrupted?: boolean }).interrupted === true;
  if (isInterrupted) {
    conn.interruptionCount++;
    console.log(
      `[audio] stream_end: interrupted (#${conn.interruptionCount}), resetting state`,
    );
  } else {
    console.log(
      `[audio] stream_end: normal (chunks=${conn.audioChunksSinceLastTurn})`,
    );
  }

  const MIN_MEANINGFUL_CHUNKS = 3;

  // Hallucination guardrail: if the user barely spoke, still close the activity
  // (activityStart was sent with the first chunk) but skip DB persistence.
  if (!isInterrupted && conn.audioChunksSinceLastTurn < MIN_MEANINGFUL_CHUNKS) {
    console.log(
      `[audio] hallucination guard: only ${conn.audioChunksSinceLastTurn} chunks, skipping DB save`,
    );
    conn.waitingForAiResponse = false;
    conn.audioChunksSinceLastTurn = 0;
    try {
      conn.gemini.send(
        JSON.stringify({
          realtimeInput: { audioStreamEnd: true },
        }),
      );
    } catch {
      // Non-critical
    }
    return;
  }

  conn.audioChunksSinceLastTurn = 0;

  if (isInterrupted) {
    if (conn.questionBuf) {
      await flushTurn(conn);
    } else if (conn.currentTurnId && conn.answerBuf) {
      await mergeAnswerBuf(conn, "\n\n");
    }
    conn.answerBuf = "";
    conn.currentTurnId = null;
    conn.questionBuf = "";
    conn.cleanQuestionBuf = "";
    conn.waitingForAiResponse = false;
    conn.audioChunksSinceLastTurn = 0;
    try {
      conn.gemini.send(
        JSON.stringify({
          realtimeInput: { audioStreamEnd: true },
        }),
      );
    } catch {
      // Non-critical
    }
    return;
  }

  if (isChallengeMode(conn)) {
    if (conn.interviewId) {
      if (!conn.currentTurnId && conn.questionBuf) {
        conn.currentTurnId = await createTurn(conn, conn.questionBuf);
      }
      if (conn.currentTurnId && conn.answerBuf) {
        await mergeAnswerBuf(conn, "\n\n");
      }
    }
  } else {
    if (conn.interviewId && conn.questionBuf) {
      await flushTurn(conn);
    } else if (conn.interviewId && conn.currentTurnId && conn.answerBuf) {
      await mergeAnswerBuf(conn);
    }
  }

  conn.waitingForAiResponse = true;
  conn.dsaTransitioned = false;

  // Signal end of user audio turn — adapter translates to activityEnd for
  // client-side VAD protocol.
  try {
    conn.gemini.send(
      JSON.stringify({
        realtimeInput: { audioStreamEnd: true },
      }),
    );
  } catch {
    // Non-critical
  }
}
