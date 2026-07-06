import { motion } from "motion/react";
import { StyleDepthPicker } from "./StyleDepthPicker";
import type { InterviewStyle, InterviewDepth } from "@evalio/shared";

const stepVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const btnNext = (enabled: boolean): React.CSSProperties => ({
  padding: "10px 24px",
  borderRadius: "8px",
  border: "none",
  background: enabled ? "var(--landing-fg, #eceae6)" : "var(--color-border)",
  color: enabled ? "var(--landing-bg, #080808)" : "var(--color-text-muted)",
  fontSize: "13px",
  fontWeight: 500,
  cursor: enabled ? "pointer" : "default",
  letterSpacing: "-0.01em",
  opacity: enabled ? 1 : 0.55,
});

const btnBack: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: "8px",
  border: "1px solid var(--color-border)",
  background: "transparent",
  color: "var(--color-text-muted)",
  fontSize: "13px",
  fontWeight: 400,
  cursor: "pointer",
};

interface StepStyleProps {
  style: InterviewStyle;
  depth: InterviewDepth;
  onStyleChange: (s: InterviewStyle) => void;
  onDepthChange: (d: InterviewDepth) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function StepStyle({
  style,
  depth,
  onStyleChange,
  onDepthChange,
  onContinue,
  onBack,
}: StepStyleProps) {
  return (
    <motion.div
      key="step-3"
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.15 }}
    >
      <div style={{ marginBottom: "28px" }}>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            fontSize: "11px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            margin: "0 0 6px",
          }}
        >
          Step 5 of 6
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: "clamp(1.25rem, 3vw, 1.6rem)",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            color: "var(--color-text)",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Style & Depth
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
            margin: "6px 0 0",
          }}
        >
          Choose how the AI interviews you
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{
            fontSize: "12px",
            color: "var(--color-text-tertiary)",
            margin: "4px 0 0",
            lineHeight: 1.4,
          }}
        >
          Style sets the tone, depth controls how hard the AI pushes. Defaults
          are tailored to your company.
        </motion.p>
      </div>
      <StyleDepthPicker
        style={style}
        depth={depth}
        onStyleChange={onStyleChange}
        onDepthChange={onDepthChange}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "24px",
        }}
      >
        <motion.button
          onClick={onBack}
          whileHover={{
            borderColor: "var(--app-accent, #b8a88a)",
            color: "var(--app-accent, #b8a88a)",
          }}
          whileTap={{ scale: 0.97 }}
          style={btnBack}
        >
          ← Back
        </motion.button>
        <motion.button
          onClick={onContinue}
          whileHover={{ opacity: 0.88 }}
          whileTap={{ scale: 0.97 }}
          style={btnNext(true)}
        >
          Continue to Resume →
        </motion.button>
      </div>
    </motion.div>
  );
}
