import { motion } from "motion/react";
import { ResumeSection } from "./ResumeSection";
import { SessionCard } from "./SessionCard";
import type {
  Resume,
  InterviewStyle,
  InterviewDepth,
  InterviewMode,
} from "@evalio/shared";

const stepVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

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

interface StepResumeProps {
  companyId: string | null;
  companyName: string | null;
  resumes: Resume[];
  effectiveResumeId: string | undefined;
  githubUrl: string;
  githubOpen: boolean;
  githubProfile: {
    username: string;
    summary: string;
    languages: string[];
    projects: {
      name: string;
      description?: string | null;
      stars?: number;
      language?: string | null;
    }[];
  } | null;
  useConnectedGithub: boolean;
  interviewMode: InterviewMode;
  interviewStyle: InterviewStyle;
  interviewDepth: InterviewDepth;
  interviewRound: string | null;
  jobDescription: string;
  selectedCompany: { name: string } | null;
  selectedRole: { title: string; duration: number } | null;
  customRole: string;
  effectivePosition: string;
  isPending: boolean;
  onResumeSelect: (id: string | undefined) => void;
  onPreviewResume: (id: string | null) => void;
  onResumesRefetch: () => void;
  onGithubUrlChange: (url: string) => void;
  onGithubToggle: () => void;
  onUseConnectedGithub: () => void;
  onJobDescriptionChange: (desc: string) => void;
  onBack: () => void;
  onCreate: () => void;
}

export function StepResume({
  companyId: _companyId,
  companyName: _companyName,
  resumes,
  effectiveResumeId,
  githubUrl,
  githubOpen,
  githubProfile,
  useConnectedGithub,
  interviewMode,
  interviewStyle,
  interviewDepth,
  interviewRound: _interviewRound,
  jobDescription,
  selectedCompany,
  selectedRole,
  customRole,
  effectivePosition,
  isPending,
  onResumeSelect,
  onPreviewResume,
  onResumesRefetch,
  onGithubUrlChange,
  onGithubToggle,
  onUseConnectedGithub,
  onJobDescriptionChange,
  onBack,
  onCreate,
}: StepResumeProps) {
  return (
    <motion.div
      key="step-4"
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.15 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: "28px" }}
      >
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
          Step 6 of 6
        </motion.p>
        <motion.h1
          style={{
            fontSize: "clamp(1.25rem, 3vw, 1.6rem)",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            color: "var(--color-text)",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Review & Start
        </motion.h1>
        <motion.p
          style={{
            fontSize: "12px",
            color: "var(--color-text-tertiary)",
            margin: "4px 0 0",
            lineHeight: 1.4,
          }}
        >
          Upload your resume and configure optional inputs. Review your
          selections below before starting.
        </motion.p>
      </motion.div>

      <ResumeSection
        resumes={resumes}
        selectedResumeId={effectiveResumeId}
        githubUrl={githubUrl}
        githubOpen={githubOpen}
        githubProfile={githubProfile}
        useConnectedGithub={useConnectedGithub}
        onResumeSelect={onResumeSelect}
        onPreviewResume={onPreviewResume}
        onResumesRefetch={onResumesRefetch}
        onGithubUrlChange={onGithubUrlChange}
        onGithubToggle={onGithubToggle}
        onUseConnectedGithub={onUseConnectedGithub}
      />

      {interviewMode !== "LIVE_CODE" && (
        <div style={{ marginTop: "24px", marginBottom: "24px" }}>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              margin: "0 0 8px",
            }}
          >
            Job description (optional)
          </p>
          <motion.textarea
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder="Paste the job description here so the AI can tailor questions..."
            rows={5}
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
              lineHeight: 1.5,
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {selectedCompany && selectedRole && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "10px",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-card)",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--color-text)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {selectedCompany.name} — {selectedRole.title}
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "var(--color-text-muted)",
              margin: "4px 0 0",
            }}
          >
            {interviewStyle === "SUPPORTIVE"
              ? "Supportive"
              : interviewStyle === "PROFESSIONAL"
                ? "Professional"
                : interviewStyle === "CHALLENGING"
                  ? "Challenging"
                  : "Bar Raiser"}{" "}
            ·{" "}
            {interviewDepth === "STANDARD"
              ? "Standard"
              : interviewDepth === "PROBING"
                ? "Probing"
                : interviewDepth === "CHALLENGE"
                  ? "Challenge"
                  : "Bar Raiser"}{" "}
            · ~{selectedRole.duration}min
          </p>
        </motion.div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
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
      </div>

      <SessionCard
        isPending={isPending}
        onCreate={onCreate}
        position={effectivePosition}
        customPosition={customRole}
        selectedResumeId={effectiveResumeId}
        resumes={resumes}
        mode={interviewMode}
      />
    </motion.div>
  );
}
