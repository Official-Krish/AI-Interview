import { motion, AnimatePresence } from "motion/react";

interface CaptionMessage {
  role: "user" | "assistant";
  text: string;
  id: string;
}

interface LiveCaptionProps {
  messages: CaptionMessage[];
  phase: "connecting" | "ready" | "ai_speaking" | "user_speaking" | "ended";
  thinking?: boolean;
  reaction?: string | null;
}

const REACTION_LABELS: Record<string, string> = {
  nod: "nodded in agreement",
  thinking: "considering your response",
  impressed: "impressed with that answer",
  skeptical: "skeptical about that reasoning",
};

export function LiveCaption({
  messages,
  phase,
  thinking,
  reaction,
}: LiveCaptionProps) {
  const latest = messages[messages.length - 1];
  const previous = messages.length > 1 ? messages[messages.length - 2] : null;

  return (
    <div className="interview-caption" aria-live="polite">
      <AnimatePresence mode="wait">
        {thinking ? (
          <motion.p
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="interview-caption-waiting"
          >
            Thinking…
          </motion.p>
        ) : latest ? (
          <motion.div
            key={latest.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="interview-caption-current"
          >
            <span className="interview-caption-role">
              {latest.role === "assistant" ? "Interviewer" : "You"}
            </span>
            <p className="interview-caption-text">{latest.text}</p>
          </motion.div>
        ) : (
          <motion.p
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="interview-caption-waiting"
          >
            {phase === "ai_speaking"
              ? "Interviewer is speaking…"
              : "Session opening…"}
          </motion.p>
        )}
      </AnimatePresence>

      {previous && (
        <p className="interview-caption-previous">
          <span className="opacity-50">
            {previous.role === "assistant" ? "Interviewer" : "You"}:
          </span>{" "}
          {previous.text.length > 90
            ? `${previous.text.slice(0, 90)}…`
            : previous.text}
        </p>
      )}

      {reaction && (
        <motion.p
          key={reaction}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 0.7, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="interview-caption-reaction"
        >
          <span className="interview-caption-reaction-dot" />
          Interviewer {REACTION_LABELS[reaction] ?? reaction}
        </motion.p>
      )}
    </div>
  );
}
