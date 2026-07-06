import type { InterviewConnection } from "../session";

const SILENCE_CHECK_INTERVAL = 10_000;
const MAX_SILENCE_PROMPTS = 3;
const SILENCE_COOLDOWN = 60_000;
let VOICE_SILENCE_THRESHOLD = 30_000;
let VOICE_EXTENDED_THRESHOLD = 45_000;
let VOICE_DESIGN_CRITIQUE_THRESHOLD = 40_000;
let DSA_SILENCE_THRESHOLD = 120_000;
let SD_SILENCE_THRESHOLD = 180_000;
let DSA_CODE_ACTIVITY_WINDOW = 30_000;
let SD_CANVAS_ACTIVITY_WINDOW = 15_000;

function applyPaceMultiplier(conn: InterviewConnection) {
  const m = conn.runtime.pace === "fast" ? 0.5 : 1.0;
  VOICE_SILENCE_THRESHOLD = Math.round(30_000 * m);
  VOICE_EXTENDED_THRESHOLD = Math.round(45_000 * m);
  VOICE_DESIGN_CRITIQUE_THRESHOLD = Math.round(40_000 * m);
  DSA_SILENCE_THRESHOLD = Math.round(120_000 * m);
  SD_SILENCE_THRESHOLD = Math.round(180_000 * m);
  DSA_CODE_ACTIVITY_WINDOW = Math.round(30_000 * m);
  SD_CANVAS_ACTIVITY_WINDOW = Math.round(15_000 * m);
}

export function startSilenceTimer(conn: InterviewConnection) {
  stopSilenceTimer(conn);
  conn.silenceTimer = setInterval(
    () => checkSilence(conn),
    SILENCE_CHECK_INTERVAL,
  );
}

export function stopSilenceTimer(conn: InterviewConnection) {
  if (conn.silenceTimer) {
    clearInterval(conn.silenceTimer);
    conn.silenceTimer = null;
  }
}

export function resetSilenceState(conn: InterviewConnection) {
  conn.lastAudioTime = Date.now();
  conn.lastCodePreviewTime = 0;
  conn.lastCanvasSnapshotTime = 0;
  conn.lastCanvasSnapshotData = null;
  conn.silencePromptCount = 0;
  conn.lastSilencePromptTime = 0;
  conn.silencePromptActive = false;
}

function checkSilence(conn: InterviewConnection) {
  if (conn.closingMode || conn.finalized) return;
  if (conn.waitingForAiResponse) return;
  if (conn.silencePromptCount >= MAX_SILENCE_PROMPTS) return;

  applyPaceMultiplier(conn);

  const now = Date.now();
  if (now - conn.lastSilencePromptTime < SILENCE_COOLDOWN) return;

  const audioElapsed = now - conn.lastAudioTime;

  const isSpecificSilent = conn.isSystemDesign
    ? audioElapsed >= SD_SILENCE_THRESHOLD &&
      now - conn.lastCanvasSnapshotTime < SD_CANVAS_ACTIVITY_WINDOW
    : conn.isDsaMode
      ? audioElapsed >= DSA_SILENCE_THRESHOLD &&
        now - conn.lastCodePreviewTime < DSA_CODE_ACTIVITY_WINDOW
      : false;

  if (isSpecificSilent) {
    sendSilencePrompt(conn, conn.isSystemDesign ? "sd" : "dsa");
    return;
  }

  // Fall through to generic silence prompt — threshold depends on variant tier
  const voiceThreshold =
    conn.silenceTier === "extended"
      ? VOICE_EXTENDED_THRESHOLD
      : conn.silenceTier === "design_critique"
        ? VOICE_DESIGN_CRITIQUE_THRESHOLD
        : VOICE_SILENCE_THRESHOLD;
  if (audioElapsed >= voiceThreshold) {
    sendSilencePrompt(conn, "voice");
  }
}

function sendSilencePrompt(
  conn: InterviewConnection,
  mode: "voice" | "dsa" | "sd",
) {
  if (!conn.gemini) return;

  conn.silencePromptCount++;
  conn.lastSilencePromptTime = Date.now();
  conn.silencePromptActive = true;

  const escalation =
    conn.silencePromptCount === 1
      ? "gentle"
      : conn.silencePromptCount === 2
        ? "firm"
        : "direct";
  const stage = conn.pacing?.getState().stage ?? "current";

  const text = buildContextSilencePrompt(
    mode,
    escalation,
    stage,
    conn.lastCanvasSnapshotData,
    conn.isDsaMode || conn.isSystemDesign,
  );

  try {
    conn.gemini.send(
      JSON.stringify({
        realtimeInput: {
          text,
          completeTurn: true,
        },
      }),
    );
  } catch (err) {
    console.error("[silence] failed to send prompt:", err);
    return;
  }

  conn.waitingForAiResponse = true;
}

function buildContextSilencePrompt(
  mode: "voice" | "dsa" | "sd",
  escalation: "gentle" | "firm" | "direct",
  stage: string,
  canvasData: unknown,
  _hasVisualContext: boolean,
): string {
  const tone =
    escalation === "gentle"
      ? "Gently encourage them to share their thoughts if it feels natural. Don't interrupt real thinking."
      : escalation === "firm"
        ? "They seem to be taking longer than expected. Ask a specific question about what they're working through."
        : "They have been quiet for an extended period. Politely ask if they need clarification or would like to move forward.";

  switch (mode) {
    case "voice":
      return `[SYSTEM: The candidate has been silent (${escalation} prompt). ${tone} You might ask something like "Take your time — what are you thinking?" or ask about the ${stage} stage of the discussion if relevant.]`;

    case "dsa":
      return `[SYSTEM: The candidate has been coding silently (${escalation} prompt). ${tone} Do NOT look at their code directly. Instead, ask a process-oriented question about their approach for the current ${stage} phase. For a first prompt try "Could you walk me through your approach so far?" For a follow-up, be more specific about the aspect they should address.]`;

    case "sd": {
      const canvasContext =
        canvasData && typeof canvasData === "object"
          ? `\n\nLatest canvas state:\n${JSON.stringify(canvasData).slice(0, 600)}`
          : "";
      return `[SYSTEM: The candidate has been working on their diagram silently (${escalation} prompt during ${stage}). ${tone} Ask a Socratic question about their design choices rather than evaluating them.${canvasContext}]`;
    }
  }
}
