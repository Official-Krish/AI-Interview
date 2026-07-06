import { useMemo } from "react";
import { motion } from "motion/react";
import { COMPANIES } from "@evalio/shared";
import toast from "react-hot-toast";

const COMMON_ROLES = [
  {
    title: "Software Engineer",
    description: "General software engineering, full stack",
  },
  {
    title: "Senior Software Engineer",
    description: "Senior-level IC, technical leadership",
  },
  {
    title: "Staff Engineer",
    description: "Deep IC, cross-team architecture, mentorship",
  },
  {
    title: "Engineering Manager",
    description: "Team leadership, people management, delivery",
  },
  {
    title: "Product Manager",
    description: "Strategy, execution, stakeholder management",
  },
  { title: "Data Scientist", description: "ML, experimentation, analytics" },
  { title: "Designer", description: "Product design, UX, interaction design" },
];

interface RolePickerProps {
  companyId: string | null;
  category?: string | null;
  selectedRoleTitle: string | null;
  customRole: string;
  onSelectRole: (title: string | null) => void;
  onCustomRoleChange: (val: string) => void;
  onContinue?: () => void;
}

const inputStyle: React.CSSProperties = {
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
};

const hoverProps = {
  whileHover: { scale: 1.02 },
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.dataset.active) {
      e.currentTarget.style.borderColor = "var(--app-accent, #b8a88a)";
      e.currentTarget.style.background =
        "var(--app-accent-bg, rgba(184,168,138,0.04))";
    }
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.dataset.active) {
      e.currentTarget.style.borderColor = "var(--color-border-light)";
      e.currentTarget.style.background = "transparent";
    }
  },
};

export function RolePicker({
  companyId,
  category,
  selectedRoleTitle,
  customRole,
  onSelectRole,
  onCustomRoleChange,
  onContinue,
}: RolePickerProps) {
  const company = useMemo(() => {
    if (!companyId || companyId === "__custom__") return null;
    return COMPANIES.find((c) => c.id === companyId) ?? null;
  }, [companyId]);

  const roles = category
    ? (company?.roles.filter((r) => r.category === category) ?? [])
    : (company?.roles ?? []);
  const isCustom = companyId === "__custom__";
  const showCustomInput =
    selectedRoleTitle === null && (isCustom || roles.length > 0);

  if (!companyId) {
    return (
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-muted)",
          textAlign: "center",
          padding: "32px 0",
        }}
      >
        Select a company first
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {!isCustom &&
          roles.map((role) => {
            const active = selectedRoleTitle === role.title;
            return (
              <motion.button
                key={role.title}
                onClick={() => {
                  onSelectRole(active ? null : role.title);
                  if (active) onCustomRoleChange("");
                  else onContinue?.();
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
                      {role.title}
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                        margin: "4px 0 0",
                      }}
                    >
                      {role.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}

        {/* Custom role option */}
        {!isCustom && (
          <>
            <motion.button
              onClick={() => {
                onSelectRole(null);
                if (!customRole) onCustomRoleChange("");
              }}
              whileTap={{ scale: 0.98 }}
              onMouseEnter={(e) => {
                const show = showCustomInput && !selectedRoleTitle;
                if (!show) {
                  e.currentTarget.style.borderColor =
                    "var(--app-accent, #b8a88a)";
                  e.currentTarget.style.background =
                    "var(--app-accent-bg, rgba(184,168,138,0.04))";
                }
              }}
              onMouseLeave={(e) => {
                const show = showCustomInput && !selectedRoleTitle;
                if (!show) {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
              style={{
                textAlign: "left",
                padding: "18px 20px",
                borderRadius: "12px",
                border:
                  showCustomInput && !selectedRoleTitle
                    ? "1.5px solid var(--app-accent, #b8a88a)"
                    : "1px dashed var(--color-border)",
                background:
                  showCustomInput && !selectedRoleTitle
                    ? "var(--app-accent-bg, rgba(184,168,138,0.06))"
                    : "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
                <div>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--color-text-secondary)",
                      margin: 0,
                    }}
                  >
                    Other (not listed)
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                      margin: "2px 0 0",
                    }}
                  >
                    Enter a custom role — AI will adapt
                  </p>
                </div>
              </div>
            </motion.button>

            {showCustomInput && !selectedRoleTitle && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ paddingLeft: "4px" }}
              >
                <input
                  value={customRole}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (
                      /system\s*design/i.test(val) &&
                      !/system\s*design/i.test(customRole)
                    ) {
                      toast(
                        "Custom System Design interviews are coming soon, but you can still practice like normal interviews.",
                        { icon: "🚧" },
                      );
                    }
                    onCustomRoleChange(val);
                  }}
                  placeholder="e.g. Staff Engineer, TPM, Design Lead..."
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--color-accent)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--color-border)")
                  }
                  autoFocus
                />
              </motion.div>
            )}
          </>
        )}

        {/* Custom company: common roles + custom input + AI decide */}
        {isCustom && (
          <>
            {COMMON_ROLES.map((role) => {
              const active = selectedRoleTitle === role.title;
              return (
                <motion.button
                  key={role.title}
                  onClick={() => {
                    onSelectRole(active ? null : role.title);
                    if (active) onCustomRoleChange("");
                    else onContinue?.();
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
                  <div>
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "var(--color-text)",
                        margin: 0,
                      }}
                    >
                      {role.title}
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                        margin: "4px 0 0",
                      }}
                    >
                      {role.description}
                    </p>
                  </div>
                </motion.button>
              );
            })}

            {/* Custom role option */}
            <motion.button
              onClick={() => {
                onSelectRole(null);
                if (!customRole) onCustomRoleChange("");
              }}
              whileTap={{ scale: 0.98 }}
              onMouseEnter={(e) => {
                const show =
                  selectedRoleTitle === null && customRole.length > 0;
                if (!show) {
                  e.currentTarget.style.borderColor =
                    "var(--app-accent, #b8a88a)";
                  e.currentTarget.style.background =
                    "var(--app-accent-bg, rgba(184,168,138,0.04))";
                }
              }}
              onMouseLeave={(e) => {
                const show =
                  selectedRoleTitle === null && customRole.length > 0;
                if (!show) {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
              style={{
                textAlign: "left",
                padding: "18px 20px",
                borderRadius: "12px",
                border:
                  selectedRoleTitle === null && customRole.length > 0
                    ? "1.5px solid var(--app-accent, #b8a88a)"
                    : "1px dashed var(--color-border)",
                background:
                  selectedRoleTitle === null && customRole.length > 0
                    ? "var(--app-accent-bg, rgba(184,168,138,0.06))"
                    : "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
                <div>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--color-text-secondary)",
                      margin: 0,
                    }}
                  >
                    Other (not listed)
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                      margin: "2px 0 0",
                    }}
                  >
                    Enter a custom role — AI will adapt
                  </p>
                </div>
              </div>
            </motion.button>

            {selectedRoleTitle === null && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ paddingLeft: "4px" }}
              >
                <input
                  value={customRole}
                  onChange={(e) => {
                    const val = e.target.value;
                    onCustomRoleChange(val);
                  }}
                  placeholder="e.g. Staff Engineer, TPM, Design Lead..."
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--color-accent)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--color-border)")
                  }
                  autoFocus
                />
              </motion.div>
            )}

            <motion.button
              onClick={() => {
                onSelectRole("__ai_decide__");
                onCustomRoleChange("");
                onContinue?.();
              }}
              whileHover={{
                borderColor: "var(--app-accent, #b8a88a)",
                color: "var(--app-accent, #b8a88a)",
              }}
              whileTap={{ scale: 0.98 }}
              style={{
                textAlign: "center",
                padding: "14px 20px",
                borderRadius: "12px",
                border: "1px dashed var(--color-border)",
                background: "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                marginTop: "4px",
              }}
            >
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "inherit",
                  margin: 0,
                }}
              >
                Skip — let AI decide
              </p>
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}
