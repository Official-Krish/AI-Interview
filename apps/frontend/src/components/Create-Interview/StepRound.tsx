import { motion } from "motion/react";
import { RoundPicker } from "./RoundPicker";

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

interface StepRoundProps {
  companyId: string | null;
  companyName: string | null;
  roleTitle: string | null;
  category: string | null;
  selectedRound: string | null;
  customRound: string;
  onSelectRound: (round: string | null) => void;
  onCustomRoundChange: (round: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepRound({
  companyId,
  companyName,
  roleTitle,
  category,
  selectedRound,
  customRound,
  onSelectRound,
  onCustomRoundChange,
  onContinue,
  onBack,
  onSkip,
}: StepRoundProps) {
  return (
    <motion.div
      key="step-2"
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
          Step 4 of 6
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
          Interview round
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
          {companyName
            ? `What stage at ${companyName}?`
            : "What type of interview round?"}
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
          Choose the round type. DSA rounds include real-time coding with AI
          feedback. Not sure? Skip and let the AI decide.
        </motion.p>
      </div>
      <RoundPicker
        companyId={companyId}
        roleTitle={roleTitle}
        category={category}
        selectedRound={selectedRound}
        customRound={customRound}
        onSelectRound={onSelectRound}
        onCustomRoundChange={onCustomRoundChange}
        onSkip={onSkip}
        onContinue={onContinue}
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
          Continue to Style →
        </motion.button>
      </div>
    </motion.div>
  );
}
