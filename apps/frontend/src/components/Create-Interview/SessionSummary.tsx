import { COMPANIES, ROLE_CATEGORIES } from "@evalio/shared";
import type {
  InterviewStyle,
  InterviewDepth,
  InterviewMode,
} from "@evalio/shared";
import { motion, AnimatePresence } from "motion/react";
import {
  IconBuildingSkyscraper,
  IconBriefcase,
  IconGitCommit,
  IconFingerprint,
  IconSettings,
  IconRadio,
  IconCategory,
} from "@tabler/icons-react";

interface SessionSummaryProps {
  companyId: string | null;
  companyName: string | null;
  roleTitle: string | null;
  customRole: string;
  selectedCategory: string | null;
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

export function SessionSummary({
  companyId,
  companyName,
  roleTitle,
  customRole,
  selectedCategory,
  interviewRound,
  interviewStyle,
  interviewDepth,
  interviewMode,
}: SessionSummaryProps) {
  const company =
    companyId && companyId !== "__custom__"
      ? (COMPANIES.find((c) => c.id === companyId) ?? null)
      : null;

  const categoryLabel =
    ROLE_CATEGORIES.find((c) => c.id === selectedCategory)?.label ??
    selectedCategory ??
    "—";

  const selections = [
    {
      label: "Field",
      value: categoryLabel,
      icon: IconCategory,
    },
    {
      label: "Company",
      value: company?.name ?? companyName ?? "—",
      icon: IconBuildingSkyscraper,
    },
    {
      label: "Role / Position",
      value: (roleTitle ?? customRole) || "—",
      icon: IconBriefcase,
    },
    {
      label: "Interview Round",
      value: interviewRound || "—",
      icon: IconGitCommit,
    },
    {
      label: "AI Interviewer Style",
      value: styleLabel[interviewStyle],
      icon: IconFingerprint,
    },
    {
      label: "Technical Depth",
      value: depthLabel[interviewDepth],
      icon: IconSettings,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-[190px] rounded-2xl border border-white/[0.04] p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.01) 0%, rgba(255, 255, 255, 0.03) 100%), var(--color-bg-card, rgba(18,18,18,0.6))",
      }}
    >
      {/* Decorative gradient light reflection */}
      <div
        className="absolute -top-10 -left-10 w-24 h-24 rounded-full pointer-events-none filter blur-[32px] opacity-15"
        style={{
          background:
            "radial-gradient(circle, var(--color-accent, #b8a88a) 0%, transparent 70%)",
        }}
      />

      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] block mb-5 font-semibold">
        Session Configurations
      </span>

      <div className="flex flex-col gap-4">
        {selections.map((s) => {
          const Icon = s.icon;
          const isPlaceholder = s.value === "—";
          return (
            <div
              key={s.label}
              className="p-3 rounded-xl border border-white/[0.02] bg-white/[0.005] hover:bg-white/[0.01] transition-all duration-300"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon
                  size={12}
                  className="text-[var(--color-text-muted)] opacity-60"
                />
                <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  {s.label}
                </span>
              </div>

              <div className="flex items-center justify-between min-w-0">
                <div className="text-[13px] font-medium leading-normal truncate min-w-0 flex items-center">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={s.value}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className={
                        isPlaceholder
                          ? "text-[var(--color-text-muted)] italic font-normal"
                          : "text-[var(--color-text)]"
                      }
                    >
                      {s.value}
                    </motion.span>
                  </AnimatePresence>

                  {s.label === "Interview Round" &&
                    interviewMode === "LIVE_CODE" && (
                      <span className="inline-flex items-center gap-1 ml-2 text-[9px] font-mono font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded px-1.5 py-0.5 align-middle shrink-0">
                        <IconRadio
                          size={10}
                          className="text-emerald-400 animate-pulse fill-emerald-400/20"
                        />
                        Live Code
                      </span>
                    )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
