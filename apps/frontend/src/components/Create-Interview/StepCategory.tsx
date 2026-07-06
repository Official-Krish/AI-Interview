import { motion } from "motion/react";
import { ROLE_CATEGORIES } from "@evalio/shared";

const stepVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const hoverProps = {
  whileHover: { scale: 1.02 },
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    if (!el.dataset.active) {
      el.style.borderColor = "var(--app-accent, #b8a88a)";
      el.style.background = "var(--app-accent-bg, rgba(184,168,138,0.04))";
    }
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    if (!el.dataset.active) {
      el.style.borderColor = "var(--color-border-light)";
      el.style.background = "transparent";
    }
  },
};

interface StepCategoryProps {
  selectedCategory: string | null;
  customFieldRole: string;
  onSelectCategory: (id: string | null) => void;
  onCustomFieldRoleChange: (value: string) => void;
  onContinue: () => void;
}

export function StepCategory({
  selectedCategory,
  customFieldRole,
  onSelectCategory,
  onCustomFieldRoleChange,
  onContinue,
}: StepCategoryProps) {
  const isOther = selectedCategory === "other";

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
          Step 1 of 6
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
          What field are you in?
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
          Your field determines the round types and interview style.
        </motion.p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {ROLE_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <motion.button
              key={cat.id}
              onClick={() => {
                if (active) {
                  onSelectCategory(null);
                } else {
                  onSelectCategory(cat.id);
                  if (cat.id !== "other") onContinue();
                }
              }}
              whileTap={{ scale: 0.98 }}
              data-active={active || undefined}
              {...hoverProps}
              style={{
                textAlign: "left",
                padding: "18px 20px",
                borderRadius: "12px",
                border: active
                  ? "1.5px solid var(--app-accent, #b8a88a)"
                  : "1px solid var(--color-border-light)",
                background: active
                  ? "var(--app-accent-bg, rgba(184,168,138,0.06))"
                  : "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      margin: 0,
                    }}
                  >
                    {cat.label}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                      margin: "4px 0 0",
                    }}
                  >
                    {cat.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}

        {isOther && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: "4px" }}
          >
            <input
              autoFocus
              value={customFieldRole}
              onChange={(e) => onCustomFieldRoleChange(e.target.value)}
              placeholder="e.g. ML Engineer, Product Manager, Quant Analyst..."
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: "14px",
                borderRadius: "10px",
                border: "1.5px solid var(--app-accent, #b8a88a)",
                background: "var(--color-bg-secondary, rgba(255,255,255,0.04))",
                color: "var(--color-text)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "12px",
                justifyContent: "flex-end",
              }}
            >
              <motion.button
                onClick={onContinue}
                whileTap={{ scale: 0.97 }}
                disabled={!customFieldRole.trim()}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: customFieldRole.trim()
                    ? "var(--app-accent, #b8a88a)"
                    : "var(--color-border-light)",
                  color: customFieldRole.trim()
                    ? "var(--color-bg)"
                    : "var(--color-text-muted)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: customFieldRole.trim() ? "pointer" : "not-allowed",
                }}
              >
                Continue
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
