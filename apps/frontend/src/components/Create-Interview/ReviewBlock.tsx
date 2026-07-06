import { COMPANIES } from "@evalio/shared";
import type {
  InterviewStyle,
  InterviewDepth,
  InterviewMode,
} from "@evalio/shared";

interface ReviewBlockProps {
  companyId: string | null;
  companyName: string | null;
  roleTitle: string | null;
  customRole: string;
  interviewRound: string | null;
  interviewStyle: InterviewStyle;
  interviewDepth: InterviewDepth;
  interviewMode: InterviewMode;
}

const styleLabel: Record<InterviewStyle, string> = {
  SUPPORTIVE: "Supportive",
  PROFESSIONAL: "Professional",
  CHALLENGING: "Challenging",
  BAR_RAISER: "Bar Raiser",
};

const depthLabel: Record<InterviewDepth, string> = {
  STANDARD: "Standard",
  PROBING: "Probing",
  CHALLENGE: "Challenge",
  BAR_RAISER: "Bar Raiser",
};

export function ReviewBlock({
  companyId,
  companyName,
  roleTitle,
  customRole,
  interviewRound,
  interviewStyle,
  interviewDepth,
  interviewMode,
}: ReviewBlockProps) {
  const company =
    companyId && companyId !== "__custom__"
      ? (COMPANIES.find((c) => c.id === companyId) ?? null)
      : null;

  const items = [
    { label: "Company", value: company?.name ?? companyName ?? "Custom" },
    { label: "Role", value: (roleTitle ?? customRole) || "General" },
    { label: "Round", value: interviewRound || "AI-decided" },
    { label: "Style", value: styleLabel[interviewStyle] },
    { label: "Depth", value: depthLabel[interviewDepth] },
  ];

  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid var(--color-border-light)",
        background: "var(--color-bg-elevated)",
        padding: "20px",
        marginBottom: "24px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          margin: "0 0 16px",
        }}
      >
        Review your selections
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-text)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {item.value}
              {item.label === "Round" && interviewMode === "LIVE_CODE" && (
                <span
                  style={{
                    fontSize: "8px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    border: "1px solid var(--color-accent-border)",
                    borderRadius: 2,
                    padding: "0 4px",
                    lineHeight: "13px",
                  }}
                >
                  Live
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
