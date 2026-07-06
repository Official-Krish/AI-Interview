import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ResultsSkeleton } from "../components/skeletons/ResultsSkeleton";
import { SEO } from "@/components/SEO";
import toast from "react-hot-toast";
import type { EvaluationStatus } from "@evalio/shared";
import { getVerdict } from "../components/Result/helpers";
import { ScoreBlock } from "../components/Result/ScoreBlock";
import { SessionMeta } from "../components/Result/SessionMeta";
import { SignalSection } from "../components/Result/SignalSection";
import { ResumeAlignment } from "../components/Result/ResumeAlignment";
import { StudyRecommendations } from "../components/Result/StudyRecommendations";
import { FeedbackCTA } from "../components/Result/FeedbackCTA";
import { TurnRow } from "../components/Result/TurnRow";
import { MomentumGraph } from "../components/Result/MomentumGraph";
import { DiscrepancyPanel } from "../components/Result/DiscrepancyPanel";
import { DsaResultsSection } from "../components/Result/DsaResultsSection";
import type { DsaSessionData } from "../components/Result/types";
import { SdDesignSection } from "../components/Result/SdDesignSection";
import type { CanvasSnapshot } from "@evalio/shared";

export function ResultsPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: interview,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["interview", id],
    queryFn: () => api.getInterview(id!),
    enabled: !!id,
    select: (d) => d.interview,
    retry: 2,
    retryDelay: 1000,
  });

  const { data: evalStatus } = useQuery({
    queryKey: ["eval-status", id],
    queryFn: () => api.evaluationStatus(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      (query.state.data as EvaluationStatus | undefined)?.status === "pending"
        ? 10_000
        : false,
  });

  const queryClient = useQueryClient();
  const [evalStuck, setEvalStuck] = useState(false);
  const [retryingEval, setRetryingEval] = useState(false);

  const prevEvalRef = useRef(evalStatus?.status);

  useEffect(() => {
    const prev = prevEvalRef.current;
    prevEvalRef.current = evalStatus?.status;
    if (prev === "pending" && evalStatus?.status === "completed") {
      toast.success(
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontWeight: 500, fontSize: "14px" }}>
            Evaluation complete!
          </span>
          <Link
            to="/analysis"
            style={{
              fontSize: "12px",
              textDecoration: "underline",
              opacity: 0.8,
            }}
            onClick={() => toast.dismiss()}
          >
            View cross-session analysis &rarr;
          </Link>
        </div>,
        { duration: 8000 },
      );
    }
  }, [evalStatus?.status]);

  useEffect(() => {
    if (evalStatus?.status !== "pending") return;
    const timer = setTimeout(() => setEvalStuck(true), 90_000);
    return () => clearTimeout(timer);
  }, [evalStatus?.status]);

  const handleRetryEval = async () => {
    if (!id || retryingEval) return;
    setRetryingEval(true);
    try {
      await api.evaluate(id);
      queryClient.invalidateQueries({ queryKey: ["eval-status", id] });
      queryClient.invalidateQueries({ queryKey: ["interview", id] });
      toast.success("Evaluation complete");
    } catch {
      toast.error("Evaluation failed. Try again.");
    } finally {
      setRetryingEval(false);
    }
  };

  if (evalStatus?.status === "failed") {
    return (
      <div className="text-center py-20 px-6">
        <p className="text-[15px] font-[500] text-[var(--color-text)] mb-2">
          Evaluation failed
        </p>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-6">
          Something went wrong while evaluating your session. You can retry or
          go back to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleRetryEval}
            disabled={retryingEval}
            className="px-5 py-[8px] rounded-full text-[13px] font-[500] cursor-pointer transition-opacity disabled:opacity-50"
            style={{
              background: "var(--color-text)",
              color: "var(--color-bg)",
            }}
          >
            {retryingEval ? "Retrying…" : "Retry evaluation"}
          </button>
          <Link
            to="/dashboard"
            className="px-5 py-[8px] rounded-full text-[13px] font-[500] no-underline border cursor-pointer"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <ResultsSkeleton />;

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-secondary)]">
          Failed to load interview
        </p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            onClick={() => refetch()}
            className="text-accent text-sm hover:underline cursor-pointer"
          >
            Try again
          </button>
          <span className="text-[var(--color-text-muted)] text-xs">|</span>
          <Link to="/dashboard" className="text-accent text-sm hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-secondary)]">
          Interview not found
        </p>
        <Link
          to="/dashboard"
          className="text-accent text-sm hover:underline mt-2 inline-block"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const overall =
    interview.overallScore != null
      ? Math.round(interview.overallScore / 10)
      : 0;
  const comm =
    interview.communicationScore != null
      ? Math.round(interview.communicationScore / 10)
      : 0;
  const tech =
    interview.technicalScore != null
      ? Math.round(interview.technicalScore / 10)
      : 0;
  const prob =
    interview.problemSolvingScore != null
      ? Math.round(interview.problemSolvingScore / 10)
      : 0;
  const turns = interview.turns ?? [];
  const verdict = getVerdict(overall);

  const scoreTrendLast5 = (interview as unknown as Record<string, unknown>)
    .scoreTrendLast5 as "improving" | "stable" | "declining" | null;

  const strengths: string[] =
    (interview.summary?.strengths as string[] | undefined) ?? [];
  const resumeStrengths: string[] =
    (interview.summary?.resumeStrengths as string[] | undefined) ?? [];
  const weaknesses: string[] =
    (interview.summary?.weaknesses as string[] | undefined) ?? [];
  const improvements: string[] =
    (interview.summary?.improvementAreas as string[] | undefined) ?? [];
  const resumeWeaknesses: string[] =
    (interview.summary?.resumeWeaknesses as string[] | undefined) ?? [];
  const recommendedTopics: string[] =
    (interview.summary?.recommendedTopics as string[] | undefined) ?? [];

  const discrepancies: Array<{
    turnNumber: number;
    liveScore: number;
    calibratedScore: number;
    direction: "up" | "down" | "unchanged";
    reason: string;
  }> =
    ((interview as unknown as Record<string, unknown>).discrepancies as
      | Array<{
          turnNumber: number;
          liveScore: number;
          calibratedScore: number;
          direction: "up" | "down" | "unchanged";
          reason: string;
        }>
      | undefined) ?? [];

  const interviewMode = (interview as unknown as Record<string, unknown>)
    .mode as string | undefined;
  const isLiveCanvas = interviewMode === "LIVE_CANVAS";
  const isLiveCode = interviewMode === "LIVE_CODE";
  const finalDiagram = (interview as unknown as Record<string, unknown>)
    .finalDiagram as CanvasSnapshot | null | undefined;

  return (
    <div className="max-w-[840px] mx-auto pb-20 px-4">
      <SEO title="Results" noindex />
      <SessionMeta interview={interview} turnsCount={turns.length} />

      <ScoreBlock
        showScore={interview.overallScore != null}
        overall={overall}
        overallConfidence={interview.overallConfidence}
        comm={comm}
        commConfidence={interview.communicationConfidence}
        tech={tech}
        techConfidence={interview.technicalConfidence}
        prob={prob}
        probConfidence={interview.problemSolvingConfidence}
        verdict={verdict}
        retryingEval={retryingEval}
        evalStuck={evalStuck}
        onRetry={handleRetryEval}
      />

      {scoreTrendLast5 && (
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-lg mb-8"
          style={{
            background: "var(--color-bg-hover)",
            border: "1px solid var(--color-border)",
          }}
        >
          <span className="text-[11px] font-[500] uppercase tracking-[0.06em]">
            <span
              style={{
                color:
                  scoreTrendLast5 === "improving"
                    ? "#22c55e"
                    : scoreTrendLast5 === "declining"
                      ? "#ef4444"
                      : "var(--color-text-muted)",
              }}
            >
              {scoreTrendLast5 === "improving"
                ? "↑"
                : scoreTrendLast5 === "declining"
                  ? "↓"
                  : "→"}
            </span>
          </span>
          <span
            className="text-[12px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {scoreTrendLast5 === "improving"
              ? "Your scores are trending upward — keep it up!"
              : scoreTrendLast5 === "declining"
                ? "Your scores have dipped recently. Consider reviewing fundamentals."
                : "Your performance has been consistent."}
          </span>
        </div>
      )}

      {turns.filter((t) => t.score != null).length >= 2 && (
        <MomentumGraph
          turns={turns.map((t) => ({
            orderNumber: t.orderNumber,
            score: t.score ?? 0,
          }))}
          momentum={interview.momentum}
          momentumSlope={interview.momentumSlope}
        />
      )}

      {discrepancies.length > 0 && (
        <DiscrepancyPanel discrepancies={discrepancies} />
      )}

      {interview.summary && (
        <div className="mb-10">
          <p
            className="text-[11px] tracking-[0.1em] uppercase mb-4 font-semibold"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            AI EVALUATION SUMMARY
          </p>
          <blockquote className="res-narrative-quote">
            {interview.summary.summary}
          </blockquote>
        </div>
      )}

      {interview.summary && (
        <SignalSection
          strengths={strengths}
          weaknesses={weaknesses}
          improvements={improvements}
        />
      )}

      {interview.summary && (
        <ResumeAlignment
          strengths={resumeStrengths}
          weaknesses={resumeWeaknesses}
        />
      )}

      <StudyRecommendations topics={recommendedTopics} />

      {isLiveCode &&
        !!(interview as unknown as Record<string, unknown>).dsaSession && (
          <DsaResultsSection
            session={
              (interview as unknown as Record<string, unknown>)
                .dsaSession as DsaSessionData
            }
          />
        )}

      {isLiveCanvas && <SdDesignSection finalDiagram={finalDiagram ?? null} />}

      {turns.length > 0 && (
        <div className="pb-12">
          <div className="flex items-center justify-between mb-5">
            <p
              className="text-[11px] tracking-[0.1em] uppercase m-0 font-semibold"
              style={{ color: "var(--landing-fg-muted)" }}
            >
              {isLiveCanvas || isLiveCode
                ? "AI QUESTIONS"
                : "QUESTIONS & ANSWERS"}
            </p>
            <span
              className="text-[11px] px-[10px] py-[2px] rounded-full border"
              style={{
                color: "var(--color-text-secondary)",
                background: "var(--color-bg-hover)",
                borderColor: "var(--color-border)",
              }}
            >
              {turns.length} exchange{turns.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="res-qa-timeline">
            {turns.map((turn, i) => (
              <TurnRow
                key={turn.id}
                turn={turn}
                index={i}
                showQuestionOnly={isLiveCanvas || isLiveCode}
              />
            ))}
          </div>
        </div>
      )}

      <FeedbackCTA />
    </div>
  );
}
