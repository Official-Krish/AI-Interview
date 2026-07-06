import toast from "react-hot-toast";
import { motion } from "motion/react";
import { RolePicker } from "./RolePicker";

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

interface StepRoleProps {
  companyId: string | null;
  companyName: string | null;
  category?: string | null;
  selectedRoleTitle: string | null;
  customRole: string;
  effectivePosition: string;
  onSelectRole: (title: string | null) => void;
  onCustomRoleChange: (role: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function StepRole({
  companyId,
  companyName,
  category,
  selectedRoleTitle,
  customRole,
  effectivePosition,
  onSelectRole,
  onCustomRoleChange,
  onContinue,
  onBack,
}: StepRoleProps) {
  return (
    <motion.div
      key="step-1"
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
          Step 3 of 6
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
          {companyName ? `Role at ${companyName}` : "Enter your role"}
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
            ? "Select the position you're applying for"
            : "Type the role you're targeting"}
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
          The role tells the AI what signals to listen for and how to tailor the
          difficulty.
        </motion.p>
      </div>
      <RolePicker
        companyId={companyId}
        category={category}
        selectedRoleTitle={selectedRoleTitle}
        customRole={customRole}
        onSelectRole={onSelectRole}
        onCustomRoleChange={onCustomRoleChange}
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
          onClick={() => {
            if (effectivePosition) onContinue();
            else toast.error("Select a role first");
          }}
          whileHover={{ opacity: effectivePosition ? 0.88 : 1 }}
          whileTap={{ scale: 0.97 }}
          style={btnNext(!!effectivePosition)}
        >
          Continue to Round →
        </motion.button>
      </div>
    </motion.div>
  );
}
