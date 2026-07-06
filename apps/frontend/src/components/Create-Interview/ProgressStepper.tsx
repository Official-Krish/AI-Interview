import { motion } from "motion/react";

interface ProgressStepperProps {
  current: number;
  onStepClick?: (step: number) => void;
}

const steps = [
  { label: "Field", sub: "Role category" },
  { label: "Company", sub: "Select company" },
  { label: "Role", sub: "Choose position" },
  { label: "Round", sub: "Interview type" },
  { label: "Interviewer", sub: "Personality & questioning depth" },
  { label: "Review", sub: "Resume & start" },
];

export function ProgressStepper({
  current,
  onStepClick,
}: ProgressStepperProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginBottom: "48px",
      }}
    >
      {steps.map((step, i) => {
        const isCompleted = i < current;
        const isCurrent = i === current;
        const clickable = isCompleted && onStepClick;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              position: "relative",
              cursor: clickable ? "pointer" : "default",
            }}
            onClick={() => clickable && onStepClick(i)}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flex: 1,
              }}
            >
              <motion.div
                animate={isCurrent ? { scale: [1, 1.08, 1] } : {}}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut",
                }}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "11px",
                  fontWeight: 600,
                  border: isCompleted
                    ? "2px solid var(--color-accent)"
                    : isCurrent
                      ? "2px solid var(--color-accent)"
                      : "2px solid var(--color-border-light)",
                  background: isCompleted
                    ? "var(--color-accent)"
                    : "transparent",
                  color: isCompleted
                    ? "#fff"
                    : isCurrent
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)",
                  transition: "all 0.2s ease",
                }}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </motion.div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "1px" }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color:
                      isCompleted || isCurrent
                        ? "var(--color-text)"
                        : "var(--color-text-muted)",
                    transition: "color 0.2s",
                    lineHeight: 1.2,
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: isCurrent
                      ? "var(--color-text-secondary)"
                      : "var(--color-text-muted)",
                    transition: "color 0.2s",
                    lineHeight: 1.2,
                  }}
                >
                  {step.sub}
                </span>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  margin: "0 16px",
                  background: isCompleted
                    ? "var(--color-accent)"
                    : "var(--color-border-light)",
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
