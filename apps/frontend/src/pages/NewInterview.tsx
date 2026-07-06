import { useState, useMemo, useEffect, useRef, startTransition } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { api } from "../lib/api";
import { useSession } from "../lib/auth";
import { ResumePreview } from "../components/ResumePreview";
import { ProgressStepper } from "../components/Create-Interview/ProgressStepper";
import { StepCompany } from "../components/Create-Interview/StepCompany";
import { StepCategory } from "../components/Create-Interview/StepCategory";
import { StepRole } from "../components/Create-Interview/StepRole";
import { StepRound } from "../components/Create-Interview/StepRound";
import { StepStyle } from "../components/Create-Interview/StepStyle";
import { StepResume } from "../components/Create-Interview/StepResume";
import { SessionSummary } from "../components/Create-Interview/SessionSummary";
import { COMPANIES, getDefaultStyleDepth, getRoundPill } from "@evalio/shared";
import { SEO } from "@/components/SEO";
import type {
  Resume,
  InterviewSession,
  InterviewStyle,
  InterviewDepth,
  InterviewMode,
} from "@evalio/shared";
import toast from "react-hot-toast";

export function NewInterviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const retryId = searchParams.get("retry");
  const [step, setStep] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customFieldRole, setCustomFieldRole] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [customCompanyName, setCustomCompanyName] = useState("");
  const [selectedRoleTitle, setSelectedRoleTitle] = useState<string | null>(
    null,
  );
  const [customRole, setCustomRole] = useState("");
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [customRound, setCustomRound] = useState("");
  const [interviewStyle, setInterviewStyle] =
    useState<InterviewStyle>("PROFESSIONAL");
  const [interviewDepth, setInterviewDepth] =
    useState<InterviewDepth>("STANDARD");
  const interviewMode = useMemo((): InterviewMode => {
    const pill = getRoundPill(selectedRound ?? "");
    if (pill === "Live Code") return "LIVE_CODE";
    if (pill === "Live Design") return "LIVE_CANVAS";
    return "VOICE";
  }, [selectedRound]);

  // Auto-scroll to top on step change
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // Auto-map custom company name to known company when typed
  useEffect(() => {
    if (selectedCompanyId !== "__custom__" || !customCompanyName.trim()) return;
    const name = customCompanyName.trim().toLowerCase();
    const match = COMPANIES.find(
      (c) => c.name.toLowerCase() === name || c.id.toLowerCase() === name,
    );
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCompanyId(match.id);
      setCustomCompanyName("");
      setStep(2);
    }
  }, [customCompanyName, selectedCompanyId]);

  // Auto-set style/depth to company defaults when switching to a custom role
  const prevRoleTitle = useRef(selectedRoleTitle);
  useEffect(() => {
    if (
      selectedCompanyId &&
      selectedRoleTitle === null &&
      prevRoleTitle.current !== null
    ) {
      const defaults = getDefaultStyleDepth(selectedCompanyId);
      setInterviewStyle(defaults.style);
      setInterviewDepth(defaults.depth);
    }
    prevRoleTitle.current = selectedRoleTitle;
  }, [selectedRoleTitle, selectedCompanyId]);
  const prevCompanyId = useRef(selectedCompanyId);
  useEffect(() => {
    if (prevCompanyId.current !== selectedCompanyId) {
      setSelectedRound(null);
      setCustomRound("");
      setSelectedRoleTitle(null);
      setCustomRole("");
    }
    prevCompanyId.current = selectedCompanyId;
  }, [selectedCompanyId]);
  const [selectedResumeId, setSelectedResumeId] = useState<
    string | undefined
  >();
  const [previewResumeId, setPreviewResumeId] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubOpen, setGithubOpen] = useState(false);
  const [useConnectedGithub, setUseConnectedGithub] = useState(true);
  const [jobDescription, setJobDescription] = useState("");

  const { data: retryInterview } = useQuery({
    queryKey: ["interview", retryId],
    queryFn: () => api.getInterview(retryId!),
    enabled: !!retryId,
    select: (d) => d.interview,
  });

  // Pre-fill form from retry interview
  const retryPrefilled = useRef(false);
  useEffect(() => {
    if (!retryInterview || retryPrefilled.current) return;
    retryPrefilled.current = true;
    startTransition(() => {
      const iv = retryInterview;
      // Try to infer category from role or company role
      if (iv.roleCategory) {
        setSelectedCategory(iv.roleCategory);
      } else if (iv.roleTitle) {
        const company = COMPANIES.find((c) => c.id === iv.companyId);
        const role = company?.roles.find((r) => r.title === iv.roleTitle);
        if (role?.category) setSelectedCategory(role.category);
      }
      if (iv.companyId && iv.roleTitle) {
        setSelectedCompanyId(iv.companyId);
        setSelectedRoleTitle(iv.roleTitle);
      } else if (iv.companyName) {
        const match = COMPANIES.find((c) => c.name === iv.companyName);
        if (match) {
          setSelectedCompanyId(match.id);
          if (iv.position) {
            const roleMatch = match.roles.find((r) => r.title === iv.position);
            if (roleMatch) setSelectedRoleTitle(roleMatch.title);
          }
        }
      }
      if (iv.position && !iv.roleTitle) setCustomRole(iv.position);
      if (iv.interviewRound) setSelectedRound(iv.interviewRound);
      if (iv.interviewStyle)
        setInterviewStyle(iv.interviewStyle as InterviewStyle);
      if (iv.interviewDepth)
        setInterviewDepth(iv.interviewDepth as InterviewDepth);
      if (iv.resume?.id) setSelectedResumeId(iv.resume.id);
      if (iv.jobDescription) setJobDescription(iv.jobDescription);
    });
  }, [retryInterview]);

  const { data: resumes, refetch: refetchResumes } = useQuery({
    queryKey: ["resumes"],
    queryFn: () => api.listResumes(),
    select: (d) => d.resumes as Resume[],
  });

  const { data: githubProfile } = useQuery({
    queryKey: ["githubProfile"],
    queryFn: () => api.getGithubProfile(),
    select: (d) => d.profile,
    retry: 1,
    staleTime: 60_000,
  });

  const { data: session } = useSession();
  const currentRole = session?.user?.role;
  const isPro = currentRole === "PRO" || currentRole === "ADMIN";
  const userLimit = currentRole === "ADMIN" ? Infinity : isPro ? 6 : 3;

  const effectiveGithubUrl = useMemo(() => {
    if (useConnectedGithub && githubProfile?.username) {
      return `https://github.com/${githubProfile.username}`;
    }
    return githubUrl;
  }, [useConnectedGithub, githubProfile, githubUrl]);

  // Auto-default to the most recently uploaded resume (user can override)
  const sortedResumes = useMemo(() => {
    if (!resumes) return [];
    return [...resumes].sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
  }, [resumes]);
  const effectiveResumeId = selectedResumeId ?? sortedResumes[0]?.id;

  const { data: interviews } = useQuery({
    queryKey: ["interviews"],
    queryFn: () => api.listInterviews(0, 100),
    select: (d) =>
      d.interviews as (InterviewSession & { _count?: { turns: number } })[],
  });

  const [now] = useState(Date.now);

  const daysUntilSlot = useMemo(() => {
    if (!interviews) return null;
    if (userLimit === Infinity) return null;
    const since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const recent = interviews
      .filter((i) => new Date(i.createdAt) >= since)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    if (recent.length < userLimit) return null;
    const oldest = new Date(recent[0]!.createdAt);
    const expiresAt = new Date(oldest.getTime() + 7 * 24 * 60 * 60 * 1000);
    return Math.ceil((expiresAt.getTime() - now) / (24 * 60 * 60 * 1000));
  }, [interviews, now, userLimit]);

  const selectedCompany =
    selectedCompanyId && selectedCompanyId !== "__custom__"
      ? (COMPANIES.find((c) => c.id === selectedCompanyId) ?? null)
      : null;

  const selectedRole =
    selectedCompany && selectedRoleTitle
      ? (selectedCompany.roles.find((r) => r.title === selectedRoleTitle) ??
        null)
      : null;

  const effectivePosition =
    selectedCategory === "other" && customFieldRole.trim()
      ? customFieldRole.trim()
      : (selectedRole?.title ??
        (selectedRoleTitle === "__ai_decide__"
          ? "General Interview"
          : customRole));
  const effectiveRound = selectedRound ?? (customRound || undefined);
  const effectiveCompanyName =
    selectedCompany?.name ??
    (selectedCompanyId === "__custom__" && customCompanyName.trim()
      ? customCompanyName.trim()
      : null);
  const effectiveCompanyId =
    selectedCompanyId && selectedCompanyId !== "__custom__"
      ? selectedCompanyId
      : null;

  const createMutation = useMutation({
    mutationFn: api.createInterview,
    onSuccess: (data) => {
      toast.success("Interview created!");
      navigate(`/interview/${data.interview.id}`);
    },
    onError: (err: Error) => {
      const msg = err.message ?? "";
      if (msg.toLowerCase().includes("rate limit")) {
        if (isPro) {
          toast.error(msg);
        } else {
          const dayMsg =
            daysUntilSlot != null && daysUntilSlot > 0
              ? ` Your next slot opens in ${daysUntilSlot} day${daysUntilSlot === 1 ? "" : "s"}.`
              : "";
          toast(
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: "4px 0",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text)",
                  }}
                >
                  Free tier limit reached
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  You've used all 3 free interviews this 7-day period.{dayMsg}
                </p>
              </div>
              <button
                onClick={() => {
                  toast.dismiss();
                  window.location.href = "/contact?subject=Pro+upgrade";
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 16px",
                  borderRadius: 6,
                  background: "var(--landing-accent, #b8a88a)",
                  color: "#080808",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Contact for upgrade
              </button>
            </div>,
            { duration: 10_000 },
          );
        }
      } else {
        const cleanMsg = msg
          .replace(/^Error:\s*/i, "")
          .replace(/^\[.*?\]\s*/, "")
          .trim();
        toast.error(cleanMsg || "Something went wrong. Please try again.");
      }
    },
  });

  const handleCreate = () => {
    if (!effectivePosition) {
      toast.error("Select a position");
      return;
    }
    if (!effectiveResumeId) {
      toast.error("Select a resume");
      return;
    }
    createMutation.mutate({
      position: effectivePosition,
      resumeId: effectiveResumeId,
      githubUrl: effectiveGithubUrl || undefined,
      jobDescription: jobDescription.trim() || undefined,
      companyId: effectiveCompanyId ?? undefined,
      companyName: effectiveCompanyName ?? undefined,
      roleTitle: selectedRoleTitle ?? undefined,
      roleCategory: selectedCategory ?? undefined,
      interviewRound: effectiveRound,
      interviewStyle,
      interviewDepth,
      mode: interviewMode,
    });
  };

  return (
    <div className="relative">
      <SEO title="New Interview" noindex />
      <div
        className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-10 max-w-5xl mx-auto"
        style={{ paddingBottom: step === 5 ? "0" : "160px" }}
      >
        <div ref={contentRef}>
          <ResumePreview
            resumeId={previewResumeId}
            open={!!previewResumeId}
            onClose={() => setPreviewResumeId(null)}
          />

          <ProgressStepper
            current={step}
            onStepClick={(s) => s < step && setStep(s)}
          />

          <AnimatePresence mode="wait">
            {step === 0 && (
              <StepCategory
                selectedCategory={selectedCategory}
                customFieldRole={customFieldRole}
                onSelectCategory={(id) => {
                  setSelectedCategory(id);
                  if (id !== "other") setCustomFieldRole("");
                }}
                onCustomFieldRoleChange={setCustomFieldRole}
                onContinue={() => setStep(1)}
              />
            )}

            {step === 1 && (
              <StepCompany
                selectedCompanyId={selectedCompanyId}
                customCompanyName={customCompanyName}
                category={selectedCategory}
                onSelectCompany={(id) => {
                  setSelectedCompanyId(id);
                  if (id !== "__custom__") setCustomCompanyName("");
                }}
                onCustomCompanyChange={setCustomCompanyName}
                onBack={() => setStep(0)}
                onContinue={() => {
                  if (selectedCompanyId === "__custom__") {
                    setSelectedRoleTitle("__ai_decide__");
                    setStep(3);
                  } else {
                    setStep(2);
                  }
                }}
                onSkip={() => setStep(5)}
              />
            )}

            {step === 2 && (
              <StepRole
                companyId={selectedCompanyId}
                companyName={selectedCompany?.name ?? null}
                category={selectedCategory}
                selectedRoleTitle={selectedRoleTitle}
                customRole={customRole}
                effectivePosition={effectivePosition}
                onSelectRole={setSelectedRoleTitle}
                onCustomRoleChange={setCustomRole}
                onContinue={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && (
              <StepRound
                companyId={selectedCompanyId}
                companyName={selectedCompany?.name ?? null}
                roleTitle={selectedRoleTitle}
                category={selectedCategory}
                selectedRound={selectedRound}
                customRound={customRound}
                onSelectRound={setSelectedRound}
                onCustomRoundChange={setCustomRound}
                onContinue={() => setStep(4)}
                onBack={() =>
                  setStep(selectedCompanyId === "__custom__" ? 1 : 2)
                }
                onSkip={() => {
                  setStep(4);
                  setSelectedRound(null);
                  setCustomRound("");
                }}
              />
            )}

            {step === 4 && (
              <StepStyle
                style={interviewStyle}
                depth={interviewDepth}
                onStyleChange={setInterviewStyle}
                onDepthChange={setInterviewDepth}
                onContinue={() => setStep(5)}
                onBack={() => setStep(3)}
              />
            )}

            {step === 5 && (
              <StepResume
                companyId={selectedCompanyId}
                companyName={effectiveCompanyName}
                resumes={resumes ?? []}
                effectiveResumeId={effectiveResumeId}
                githubUrl={effectiveGithubUrl}
                githubOpen={githubOpen}
                githubProfile={githubProfile ?? null}
                useConnectedGithub={useConnectedGithub}
                interviewMode={interviewMode}
                interviewStyle={interviewStyle}
                interviewDepth={interviewDepth}
                interviewRound={selectedRound}
                jobDescription={jobDescription}
                selectedCompany={selectedCompany}
                selectedRole={selectedRole}
                customRole={customRole}
                effectivePosition={effectivePosition}
                isPending={createMutation.isPending}
                onResumeSelect={setSelectedResumeId}
                onPreviewResume={setPreviewResumeId}
                onResumesRefetch={() => refetchResumes()}
                onGithubUrlChange={(url) => {
                  setGithubUrl(url);
                  setUseConnectedGithub(false);
                }}
                onGithubToggle={() => setGithubOpen((p) => !p)}
                onUseConnectedGithub={() => {
                  setUseConnectedGithub(true);
                  setGithubOpen(false);
                  if (githubProfile?.username) {
                    setGithubUrl(
                      `https://github.com/${githubProfile.username}`,
                    );
                  }
                }}
                onJobDescriptionChange={setJobDescription}
                onBack={() => setStep(4)}
                onCreate={handleCreate}
              />
            )}
          </AnimatePresence>
        </div>

        <aside className="hidden lg:block">
          <SessionSummary
            companyId={selectedCompanyId}
            companyName={effectiveCompanyName}
            roleTitle={selectedRoleTitle}
            customRole={customRole}
            selectedCategory={selectedCategory}
            interviewRound={selectedRound}
            interviewStyle={interviewStyle}
            interviewDepth={interviewDepth}
            interviewMode={interviewMode}
          />
        </aside>
      </div>
    </div>
  );
}
