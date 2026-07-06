import { useRef, useEffect, type RefObject } from "react";
import { motion, AnimatePresence } from "motion/react";

type SessionPhase =
  | "connecting"
  | "ready"
  | "ai_speaking"
  | "user_speaking"
  | "ended";

interface SessionControlsProps {
  micActive: boolean;
  phase: SessionPhase;
  onMicToggle: () => void;
  onEnd: () => void;
  ending?: boolean;
  userAnalyserRef?: RefObject<AnalyserNode | null>;
}

const PHASE_CONFIG = {
  ready: {
    label: "Your turn",
    hint: "Tap to speak",
    micDisabled: false,
    accent: "rgba(184, 168, 138, 0.6)",
  },
  ai_speaking: {
    label: "Interviewer",
    hint: "Listening…",
    micDisabled: true,
    accent: "rgba(184, 168, 138, 0.9)",
  },
  user_speaking: {
    label: "You",
    hint: "Recording…",
    micDisabled: false,
    accent: "rgba(236, 234, 230, 0.85)",
  },
};

export function SessionControls({
  micActive,
  phase,
  onMicToggle,
  onEnd,
  ending = false,
  userAnalyserRef,
}: SessionControlsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const config =
    phase === "connecting" || phase === "ended" ? null : PHASE_CONFIG[phase];
  const micDisabled =
    phase === "ai_speaking" ||
    phase === "connecting" ||
    phase === "ended" ||
    ending;

  // Draw waveform on canvas when user is speaking
  useEffect(() => {
    if (phase !== "user_speaking" || !userAnalyserRef?.current) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width * dpr;
      const h = rect.height * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      const analyser = userAnalyserRef.current;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const barCount = 24;
        const barW = (w / barCount) * 0.7;
        const gap = (w / barCount) * 0.3;
        for (let i = 0; i < barCount; i++) {
          const avg = (data[i * 3]! + data[i * 3 + 1]! + data[i * 3 + 2]!) / 3;
          const norm = avg / 255;
          const barH = Math.max(2, norm * h * 0.9);
          const x = i * (barW + gap);
          const y = (h - barH) / 2;
          ctx.fillStyle = `rgba(236, 234, 230, ${0.3 + norm * 0.6})`;
          ctx.beginPath();
          ctx.roundRect(x, y, barW, barH, 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, userAnalyserRef]);

  return (
    <div className="interview-controls">
      <button
        type="button"
        onClick={onEnd}
        disabled={ending}
        className="interview-control-end"
        aria-label="End session"
      >
        {ending ? "Ending…" : "End session"}
      </button>

      <div className="interview-control-center">
        {/* Waveform canvas — visible during user_speaking */}
        {phase === "user_speaking" && (
          <canvas
            ref={canvasRef}
            className="interview-user-waveform"
            aria-hidden
          />
        )}

        {/* Phase pill */}
        <AnimatePresence mode="wait">
          {config && (
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="interview-phase-pill"
              style={{ borderColor: config.accent, color: config.accent }}
            >
              <span
                className="interview-phase-pill-dot"
                style={{ background: config.accent }}
              />
              <span>{config.label}</span>
              <span className="interview-phase-pill-hint">{config.hint}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={onMicToggle}
          disabled={micDisabled}
          whileTap={{ scale: 0.94 }}
          className={`interview-control-mic ${
            micActive ? "interview-control-mic-active" : ""
          } ${phase === "ready" ? "interview-control-mic-ready" : ""}`}
          aria-label={micActive ? "Mute microphone" : "Open microphone"}
          animate={phase === "ready" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={
            phase === "ready"
              ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
              : {}
          }
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            {micActive ? (
              <>
                <path
                  d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M19 10v2a7 7 0 0 1-14 0v-2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <path
                  d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M19 10v2a7 7 0 0 1-14 0v-2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="12"
                  y1="19"
                  x2="12"
                  y2="22"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
        </motion.button>
      </div>

      <div className="interview-control-spacer" aria-hidden />
    </div>
  );
}
