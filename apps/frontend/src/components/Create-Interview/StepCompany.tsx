import { motion } from "motion/react";
import { CompanyGrid } from "./CompanyGrid";

const stepVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const btnNext = (enabled: boolean): React.CSSProperties => ({
  padding: "10px 24px",
  borderRadius: "8px",
  border: "none",
  background: "var(--landing-fg, #eceae6)",
  color: "var(--landing-bg, #080808)",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  letterSpacing: "-0.01em",
  opacity: enabled ? 1 : 0.55,
});

interface StepCompanyProps {
  selectedCompanyId: string | null;
  customCompanyName: string;
  category?: string | null;
  onSelectCompany: (id: string | null) => void;
  onCustomCompanyChange: (name: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

export function StepCompany({
  selectedCompanyId,
  customCompanyName,
  category,
  onSelectCompany,
  onCustomCompanyChange,
  onContinue,
  onSkip,
  onBack,
}: StepCompanyProps) {
  const isCustom = selectedCompanyId === "__custom__";
  return (
    <motion.div
      key="step-0"
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
          Step 2 of 6
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
          {isCustom ? "Enter your company" : "Select a company"}
        </motion.h1>
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
          {isCustom
            ? "Type your company and we'll adapt the AI to match."
            : "Every company interviews differently. Pick one and we'll adapt the AI to match."}
        </motion.p>
      </div>

      {isCustom ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              margin: "0 0 0.4rem",
            }}
          >
            Company name
          </p>
          <motion.input
            value={customCompanyName}
            onChange={(e) => onCustomCompanyChange(e.target.value)}
            placeholder="e.g. Tesla, Coinbase, Spotify..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && customCompanyName.trim()) {
                onContinue();
              }
            }}
            whileFocus={{ borderColor: "rgba(184, 168, 138, 0.35)" }}
            transition={{ borderColor: { duration: 0.15 } }}
            style={{
              width: "100%",
              padding: "0.7rem 0.9rem",
              fontSize: "13px",
              borderRadius: "2px",
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text)",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "16px",
            }}
          >
            <motion.button
              onClick={() => customCompanyName.trim() && onContinue()}
              whileHover={{ opacity: 0.88 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                background: customCompanyName.trim()
                  ? "var(--landing-fg, #eceae6)"
                  : "var(--color-border)",
                color: customCompanyName.trim()
                  ? "var(--landing-bg, #080808)"
                  : "var(--color-text-muted)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: customCompanyName.trim() ? "pointer" : "default",
                letterSpacing: "-0.01em",
                opacity: customCompanyName.trim() ? 1 : 0.55,
              }}
            >
              Continue to Round →
            </motion.button>
          </div>
          <div style={{ marginTop: "16px" }}>
            <motion.button
              onClick={() => {
                onSelectCompany(null);
                onCustomCompanyChange("");
              }}
              whileHover={{
                borderColor: "var(--app-accent, #b8a88a)",
                color: "var(--app-accent, #b8a88a)",
              }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-muted)",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              ← Choose from list
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <>
          <CompanyGrid
            selectedCompanyId={selectedCompanyId}
            category={category}
            onSelect={(id) => {
              onSelectCompany(id);
              if (id && id !== "__custom__") {
                onContinue();
              }
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "24px",
            }}
          >
            {onBack && (
              <motion.button
                onClick={onBack}
                whileHover={{
                  borderColor: "var(--app-accent, #b8a88a)",
                  color: "var(--app-accent, #b8a88a)",
                }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  color: "var(--color-text-muted)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                ← Back
              </motion.button>
            )}
            <motion.button
              onClick={() => {
                if (selectedCompanyId) onContinue();
                else onSkip();
              }}
              whileHover={{ opacity: 0.88 }}
              whileTap={{ scale: 0.97 }}
              style={btnNext(!!selectedCompanyId)}
            >
              {selectedCompanyId ? "Continue" : "Skip"} →
            </motion.button>
          </div>
        </>
      )}
    </motion.div>
  );
}
