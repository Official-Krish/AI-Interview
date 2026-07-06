import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { InterviewTurn } from "@evalio/shared";

export function TurnRow({
  turn,
  index,
  showQuestionOnly,
}: {
  turn: InterviewTurn;
  index: number;
  showQuestionOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const score = turn.score != null ? Math.round(turn.score / 10) : null;
  const isLow = score != null && score < 6;

  const scoreClass =
    score == null ? "" : score >= 7 ? "great" : score >= 5 ? "ok" : "poor";

  const thinkingTime =
    turn.answerStartMs && turn.questionStartMs
      ? Math.max(0, (turn.answerStartMs - turn.questionStartMs) / 1000)
      : null;
  const speakingTime =
    turn.answerEndMs && turn.answerStartMs
      ? Math.max(0, (turn.answerEndMs - turn.answerStartMs) / 1000)
      : null;

  if (showQuestionOnly) {
    return (
      <div className="res-qa-row">
        <div className="res-qa-header" style={{ cursor: "default" }}>
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <span className="res-qa-label">Q{index + 1}</span>
            <p className="res-qa-question">{turn.questionText}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {score != null && (
              <span className={`res-qa-score-badge ${scoreClass}`}>
                {score}/10
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="res-qa-row">
      <button onClick={() => setExpanded(!expanded)} className="res-qa-header">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <span className="res-qa-label">Q{index + 1}</span>
          <p className="res-qa-question">{turn.questionText}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {score != null && (
            <span className={`res-qa-score-badge ${scoreClass}`}>
              {score}/10
            </span>
          )}
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0"
          >
            <path d="M3 5l4 4 4-4" />
          </motion.svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="res-qa-body">
              <p className="res-qa-answer">
                {turn.answerText || (
                  <span className="italic opacity-60">
                    (No verbal answer captured)
                  </span>
                )}
              </p>

              {(thinkingTime !== null || speakingTime !== null) && (
                <div className="flex items-center gap-4 mt-3 mb-4 text-[11px] text-[var(--color-text-muted)] font-mono">
                  {thinkingTime !== null && (
                    <span className="flex items-center gap-1.5">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-75"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Thinking: {thinkingTime.toFixed(1)}s
                    </span>
                  )}
                  {speakingTime !== null && (
                    <span className="flex items-center gap-1.5">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-75"
                      >
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                      Speaking: {speakingTime.toFixed(1)}s
                    </span>
                  )}
                </div>
              )}

              {turn.feedback && (
                <div className="res-qa-feedback">
                  <p>{turn.feedback}</p>
                </div>
              )}

              {(turn.weight != null || turn.evidence) && (
                <div
                  className="flex items-center gap-3 mt-3 mb-1 text-[11px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {turn.weight != null && (
                    <span className="flex items-center gap-1">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-60"
                      >
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                      Weight: {turn.weight.toFixed(1)}
                    </span>
                  )}
                  {turn.evidence && (
                    <span className="flex items-center gap-1">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-60"
                      >
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      {turn.evidence}
                    </span>
                  )}
                </div>
              )}

              {isLow && (
                <div className="mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModel(!showModel);
                    }}
                    className="text-[11px] tracking-[0.06em] uppercase bg-none border-none cursor-pointer inline-flex items-center gap-1.5 p-0 font-[500]"
                    style={{ color: "var(--app-accent, #b8a88a)" }}
                  >
                    <motion.span
                      animate={{ rotate: showModel ? 90 : 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      ▶
                    </motion.span>
                    {showModel ? "Hide" : "Show"} model answer
                  </button>

                  <AnimatePresence>
                    {showModel && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="res-console-wrapper">
                          <div className="res-console-header">
                            <div className="res-console-dots">
                              <span className="res-console-dot red" />
                              <span className="res-console-dot yellow" />
                              <span className="res-console-dot green" />
                            </div>
                            <span className="res-console-title">
                              Model Answer Console
                            </span>
                          </div>
                          <p className="res-console-content">
                            A strong response would directly address the
                            question with a specific example from your
                            experience, using the STAR method (Situation, Task,
                            Action, Result) to structure your answer clearly and
                            concisely — quantifying impact wherever possible.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
