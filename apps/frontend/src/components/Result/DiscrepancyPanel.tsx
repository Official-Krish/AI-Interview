import { motion } from "motion/react";

interface Discrepancy {
  turnNumber: number;
  liveScore: number;
  calibratedScore: number;
  direction: "up" | "down" | "unchanged";
  reason: string;
}

interface Props {
  discrepancies: Discrepancy[];
}

export function DiscrepancyPanel({ discrepancies }: Props) {
  const adjusted = discrepancies.filter((d) => d.direction !== "unchanged");
  if (!discrepancies.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10"
    >
      <p
        className="text-[11px] tracking-[0.1em] uppercase mb-3 font-semibold"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        SCORE VALIDATION
        {adjusted.length > 0 && (
          <span
            className="ml-2 text-[10px] font-normal lowercase"
            style={{ color: "var(--color-text-muted)" }}
          >
            ({adjusted.length} adjustment{adjusted.length !== 1 ? "s" : ""})
          </span>
        )}
      </p>
      <div className="flex flex-col gap-2">
        {discrepancies.map((d) => {
          const diff = d.calibratedScore - d.liveScore;
          const isAdjusted = d.direction !== "unchanged";
          return (
            <div
              key={d.turnNumber}
              className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{
                background: isAdjusted
                  ? "var(--color-bg-hover)"
                  : "transparent",
                border: `1px solid ${
                  isAdjusted
                    ? d.direction === "up"
                      ? "rgba(34,197,94,0.2)"
                      : "rgba(239,68,68,0.2)"
                    : "var(--color-border-light)"
                }`,
              }}
            >
              <span
                className="text-[11px] font-[600] flex-shrink-0 mt-0.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Q{d.turnNumber}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[12px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Live:{" "}
                    <span
                      className="font-[500]"
                      style={{ color: "var(--color-text)" }}
                    >
                      {d.liveScore}
                    </span>
                  </span>
                  {isAdjusted && (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="var(--color-text-muted)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 3l4 4-4 4" />
                      </svg>
                      <span
                        className="text-[12px]"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Calibrated:{" "}
                        <span
                          className="font-[500]"
                          style={{ color: diff > 0 ? "#22c55e" : "#ef4444" }}
                        >
                          {d.calibratedScore}
                        </span>
                      </span>
                      <span
                        className="text-[11px] font-mono"
                        style={{ color: diff > 0 ? "#22c55e" : "#ef4444" }}
                      >
                        ({diff > 0 ? "+" : ""}
                        {diff})
                      </span>
                    </>
                  )}
                  {!isAdjusted && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(34,197,94,0.1)",
                        color: "#22c55e",
                      }}
                    >
                      Verified
                    </span>
                  )}
                </div>
                <p
                  className="text-[12px] leading-[1.5] m-0"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {d.reason}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
