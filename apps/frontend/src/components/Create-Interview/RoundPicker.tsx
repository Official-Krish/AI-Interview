import { useState } from "react";
import { motion } from "motion/react";
import {
  CATEGORY_ROUNDS,
  FALLBACK_ROUNDS,
  getCompany,
  getRoundPill,
} from "@evalio/shared";

interface RoundPickerProps {
  companyId: string | null;
  roleTitle: string | null;
  category: string | null;
  selectedRound: string | null;
  customRound: string;
  onSelectRound: (round: string | null) => void;
  onCustomRoundChange: (val: string) => void;
  onSkip: () => void;
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

const descriptions: Record<string, string> = {
  "Coding Round (DSA)":
    "Algorithmic coding challenge — data structures, problem-solving, optimization",
  "Phone Screen": "Breadth check — past experience, motivation, fundamentals",
  "Technical & Coding":
    "Deep dive into coding, algorithms, and problem-solving",
  "Technical Coding": "Deep dive into coding, algorithms, and problem-solving",
  "Technical Deep Dive": "Deep domain expertise and technical rigor",
  "Coding & Algorithms": "Algorithmic thinking and clean code under pressure",
  "Coding & Problem Solving": "Problem-solving with code in real time",
  "System Design": "Architecture, tradeoffs, and high-level design thinking",
  "System Design & Architecture": "Scalable architecture and design tradeoffs",
  "System Design & Integration":
    "Cross-system architecture and integration patterns",
  "System Design & Risk": "Low-latency, high-reliability system design",
  "Real-time Systems Design": "Latency-critical, geo-distributed architecture",
  "Observability & System Design":
    "Monitoring-first architecture and reliability",
  "Product Design & Architecture":
    "Product-aware system design and user impact",
  "Architecture & Strategy": "Technical vision and architectural strategy",
  "Rendering & Collaboration":
    "Canvas performance, real-time sync, WebAssembly",
  "Blocks & Architecture": "Composable extensibility and data architecture",
  "Data Integration & Ontology": "Complex data pipelines and ontology design",
  "Behavioral & PMA":
    "Leadership, collaboration, and people management assessment",
  "Leadership Principles & Behavior":
    "STAR-based leadership and principle-driven behavior",
  "Leadership & Behavior":
    "Ownership, conflict resolution, and decision-making",
  "Leadership & Culture": "Freedom, responsibility, and cultural contribution",
  "Behavioral & Growth": "Growth mindset and cross-team collaboration",
  "Craftsmanship & Behavior": "Attention to detail and privacy-first mindset",
  "Operational & Behavior": "Incident response and operational excellence",
  "Host-centric & Behavior": "Community focus and full-stack ownership",
  "SRE & Reliability": "Observability, incident response, chaos engineering",
  "Client & Behavior": "Stakeholder management and client delivery focus",
  "Compliance & Behavior": "Regulatory thinking and precision under pressure",
  "Mission & Behavior":
    "Mission-driven problem-solving in complex environments",
  "Design & Culture": "Design-meets-engineering and creative collaboration",
  "Product & Behavior": "Product craftsmanship and tool-for-thought mindset",
  "Founder & Culture Fit":
    "Generalist mindset and high-velocity decision-making",
  "Case Study & Analysis":
    "Structured problem-solving and analytical frameworks",

  // Category-specific round descriptions
  "Behavioral / Experience":
    "Past experience, behavioral questions, and cultural fit assessment",
  "Case Study": "Business scenario analysis with structured problem-solving",
  "Client Presentation":
    "Stakeholder communication and technical presentation skills",
  "Quantitative Analysis":
    "Data-driven analysis, metrics, and numerical reasoning",
  "Product Sense":
    "Product design thinking, user empathy, and feature prioritization",
  "Design Critique":
    "UI/UX evaluation, usability analysis, and improvement suggestions",
  "Leadership / Behavioral":
    "Leadership principles, team management, and decision-making",
  "Strategy & Vision":
    "Technical strategy, roadmap planning, and organizational impact",
  "SQL & Analytics":
    "SQL querying, data analysis, and analytical problem-solving",
  "ML System Design":
    "End-to-end ML system architecture, training, and serving",
  "Data Architecture":
    "Data modeling, pipeline design, and storage systems at scale",
  "Infrastructure Design":
    "Infrastructure architecture, reliability, and platform engineering",
  "Incident Response":
    "Production incident diagnosis, mitigation, and post-mortem",
  "CI/CD & Automation":
    "Pipeline design, deployment strategies, and automation at scale",
  Behavioral: "General behavioral assessment covering collaboration and growth",

  // hft rounds
  "Quantitative & Probability":
    "Quantitative reasoning, probability puzzles, and mental math under pressure",
  "Low-Latency C++ Coding":
    "C++ systems programming, lock-free data structures, memory optimization",
  "Low-Latency System Design":
    "Nanosecond-level trading systems, kernel bypass, hardware co-design",
  "Behavioral / HFT Fit":
    "HFT culture fit, risk awareness, decision-making under uncertainty",

  // security rounds
  "Threat Modeling":
    "Security architecture review, threat identification, and mitigation strategies",
  "Vulnerability Analysis":
    "Code review, exploit identification, and defensive programming",

  // mobile rounds
  "Mobile Architecture":
    "iOS/Android architecture, offline-first, performance, cross-platform tradeoffs",

  // research rounds
  "Paper Critique":
    "Critical analysis of ML/systems research papers — methodology, results, impact",
  "Research Deep Dive":
    "In-depth exploration of past research, experimental design, and scientific rigor",

  // finance rounds
  "Quantitative Case":
    "Financial modeling, derivatives pricing, risk analytics, and structured problem-solving",
  "Market & Risk Scenario":
    "Market dynamics, portfolio risk, and scenario-based decision-making",

  // hardware rounds
  "Hardware Design":
    "Embedded systems, silicon design, PCB architecture, and firmware",
  "Debugging Scenario":
    "Hardware fault diagnosis, root cause analysis, and systematic debugging",

  // sales_gtm rounds
  "Mock Pitch":
    "Stakeholder presentation, value proposition, and objection handling",
  "Discovery Call Simulation":
    "Customer needs discovery, qualification, and consultative selling",

  // company-specific rounds
  "Googleyness & Leadership":
    "Culture fit, collaboration, and Google's unique leadership attributes",
  "Technical & Architecture":
    "Deep architecture discussion, technical strategy, and solution design",
  "Quantitative & Behavioural":
    "Quantitative reasoning combined with behavioral and cultural fit assessment",
  "Partner & Fit":
    "Partnership potential, client relationship skills, and cultural alignment",
  "Technical Discussion":
    "Domain-specific technical conversation covering depth and breadth",
  "Product & Behaviour":
    "Product thinking combined with behavioral and collaboration assessment",
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

export function RoundPicker({
  companyId,
  roleTitle: _roleTitle,
  category,
  selectedRound,
  customRound,
  onSelectRound,
  onCustomRoundChange,
  onSkip,
  onContinue,
}: RoundPickerProps) {
  const [showingOther, setShowingOther] = useState(false);
  const categoryRounds =
    category && category in CATEGORY_ROUNDS
      ? CATEGORY_ROUNDS[category as keyof typeof CATEGORY_ROUNDS]
      : FALLBACK_ROUNDS;
  const rounds = categoryRounds.map((r) => r.label);

  const isCustom = companyId === "__custom__";
  const hasChosen = selectedRound !== null;

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

  const company = companyId ? getCompany(companyId) : null;
  const companyRounds = company?.interviewRounds
    ?.filter((r) => !rounds.includes(r))
    ?.sort((a, b) => {
      const pa = getRoundPill(a) ? 0 : 1;
      const pb = getRoundPill(b) ? 0 : 1;
      return pa - pb;
    });
  const sortedRounds = [...rounds].sort((a, b) => {
    const pa = getRoundPill(a) ? 0 : 1;
    const pb = getRoundPill(b) ? 0 : 1;
    return pa - pb;
  });

  function renderRoundButton(round: string) {
    const active = selectedRound === round;
    const pill = getRoundPill(round);
    return (
      <motion.button
        key={round}
        onClick={() => {
          if (!active) {
            onSelectRound(round);
            onCustomRoundChange("");
            setShowingOther(false);
            onContinue?.();
          } else {
            onSelectRound(null);
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
        <div>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--color-text)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {round}
            {pill && (
              <span
                className="inline-flex items-center gap-1"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent-border)",
                  borderRadius: 3,
                  padding: "1px 5px",
                  lineHeight: "14px",
                }}
              >
                <span
                  className="w-1 h-1 rounded-full"
                  style={{
                    background: "var(--color-accent)",
                    boxShadow: "0 0 4px var(--color-accent-border)",
                  }}
                />
                {pill}
              </span>
            )}
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "var(--color-text-muted)",
              margin: "4px 0 0",
            }}
          >
            {descriptions[round] ?? ""}
          </p>
        </div>
      </motion.button>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {companyRounds && companyRounds.length > 0 && (
          <>
            <p
              style={{
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                margin: "0 0 2px",
                padding: "0 4px",
              }}
            >
              Recommended for {company!.name}
            </p>
            {companyRounds.map(renderRoundButton)}
            <div
              style={{
                height: "1px",
                background: "var(--color-border-light)",
                margin: "4px 0",
              }}
            />
          </>
        )}
        {sortedRounds.map(renderRoundButton)}

        <motion.button
          onClick={() => {
            setShowingOther(true);
            if (selectedRound) {
              onSelectRound(null);
              onCustomRoundChange("");
            }
          }}
          whileTap={{ scale: 0.98 }}
          style={{
            textAlign: "left",
            padding: "18px 20px",
            borderRadius: "12px",
            border:
              showingOther && !hasChosen
                ? "1.5px solid var(--app-accent, #b8a88a)"
                : "1px dashed var(--color-border)",
            background:
              showingOther && !hasChosen
                ? "var(--app-accent-bg, rgba(184,168,138,0.06))"
                : "transparent",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--app-accent, #b8a88a)";
            e.currentTarget.style.background =
              "var(--app-accent-bg, rgba(184,168,138,0.04))";
          }}
          onMouseLeave={(e) => {
            if (!(showingOther && !hasChosen)) {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                Describe the round type — AI will adapt
              </p>
            </div>
          </div>
        </motion.button>

        {showingOther && !hasChosen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            style={{ paddingLeft: "4px" }}
          >
            <input
              value={customRound}
              onChange={(e) => {
                onCustomRoundChange(e.target.value);
                onSelectRound(null);
              }}
              placeholder="e.g. Take-home Assignment, Whiteboarding, Cross-functional..."
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

        {isCustom && (
          <motion.button
            onClick={() => {
              onSkip();
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
        )}
      </div>
    </div>
  );
}
