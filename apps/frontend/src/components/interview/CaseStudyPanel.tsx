interface CaseStudyPanelProps {
  visible: boolean;
  topicTitle: string;
  topicDescription: string;
  fullProblemText: string;
}

export function CaseStudyPanel({
  visible,
  topicTitle,
  topicDescription,
  fullProblemText,
}: CaseStudyPanelProps) {
  if (!visible) return null;

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: "55vw",
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    background: "var(--db-card-bg)",
    borderLeft: "1px solid var(--app-accent-border)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow: "var(--db-card-shadow)",
    overflow: "hidden",
  };

  const headerStyle: React.CSSProperties = {
    padding: "20px 24px 16px",
    borderBottom: "1px solid var(--app-accent-border)",
    flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--color-text)",
    marginBottom: "4px",
    lineHeight: 1.3,
  };

  const descStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "var(--color-text-muted)",
    lineHeight: 1.5,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: "auto",
    padding: "24px",
    fontSize: "14px",
    lineHeight: 1.7,
    color: "var(--color-text)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>{topicTitle}</div>
        {topicDescription && <div style={descStyle}>{topicDescription}</div>}
      </div>
      <div style={contentStyle}>{fullProblemText}</div>
    </div>
  );
}
