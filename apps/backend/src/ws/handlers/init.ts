import { prisma } from "../../lib/prisma";
import { COMPANIES } from "@evalio/shared";
import { getSdQuestion } from "../../routes/sd";
import {
  getCanvasQuestion,
  getDiscussionQuestion,
} from "../../services/question";
import { verifyWsToken, startInterview } from "../orchestrator";
import { tryActivate, enqueue as queueEnqueue } from "../../lib/queue";
import { buildMemoryBrief, buildRuntimeGuidance } from "@evalio/memory";
import type { InterviewConnection } from "../session";
import { startHeartbeat } from "../helpers/heartbeat";
import { PacingTracker } from "../helpers/pacing";
import {
  resolveRoute,
  buildPromptFromRoute,
  type PromptInput,
  type SystemDesignPromptInput,
  VOICE_BUDGETS,
  DSA_BUDGETS,
  SD_BUDGETS,
} from "@evalio/prompts";

export async function handleInit(
  conn: InterviewConnection,
  msg: Record<string, unknown>,
) {
  const token = msg.token as string | undefined;
  if (!token) {
    await conn.safeSend({ error: "Authentication required" });
    conn.client.close();
    return;
  }

  const payload = await verifyWsToken(token);
  if (!payload) {
    await conn.safeSend({ error: "Invalid or expired token" });
    conn.client.close();
    return;
  }

  const userId = payload.id;

  conn.interviewId = msg.interviewId as string;
  if (!conn.interviewId) {
    await conn.safeSend({ error: "interviewId is required" });
    return;
  }

  console.log(`[ws] init: user=${userId} interview=${conn.interviewId}`);

  const interview = await prisma.interviewSession.findUnique({
    where: { id: conn.interviewId },
    include: {
      resume: true,
      user: {
        include: {
          githubProfile: true,
        },
      },
    },
  });
  if (!interview) {
    await conn.safeSend({ error: "Interview not found" });
    return;
  }
  if (interview.userId !== userId) {
    await conn.safeSend({ error: "Unauthorized" });
    return;
  }

  if (interview.status === "COMPLETED") {
    await conn.safeSend({ error: "Interview already completed" });
    return;
  }

  const lastTurn = await prisma.interviewTurn.findFirst({
    where: { interviewId: conn.interviewId },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  conn.nextOrderNumber = (lastTurn?.orderNumber ?? 0) + 1;

  const github = interview.user.githubProfile;
  const userRole = interview.user.role ?? "FREE";
  const companyConfig = interview.companyId
    ? COMPANIES.find((c) => c.id === interview.companyId)
    : null;

  conn.interviewDepth = interview.interviewDepth ?? "STANDARD";

  const selectedRole =
    companyConfig?.roles.find((r) => r.title === interview.roleTitle) ?? null;
  const seniorityLabel = selectedRole?.seniorityLabel ?? null;

  const pastInterviews = await prisma.interviewSession.findMany({
    where: {
      userId: interview.userId,
      status: "COMPLETED",
      id: { not: interview.id },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { summary: true },
  });

  const skillProfile = await prisma.candidateSkillProfile.findUnique({
    where: { userId: interview.userId },
  });

  // Memory-aware personalization: build a Candidate Memory Brief for the
  // system prompt and a compact runtime guidance block for silent injection.
  const memoryTopic =
    interview.position ??
    (interview as { roleTitle?: string | null }).roleTitle ??
    (interview as { roleCategory?: string | null }).roleCategory ??
    null;
  const [memoryBrief, runtimeGuidance] = await Promise.all([
    buildMemoryBrief(interview.userId, memoryTopic).catch((err) => {
      console.error("[init] memory brief failed:", err);
      return null;
    }),
    buildRuntimeGuidance(interview.userId, memoryTopic).catch((err) => {
      console.error("[init] runtime guidance failed:", err);
      return null;
    }),
  ]);
  conn.runtimeMemoryGuidance = runtimeGuidance;

  const scoredInterviews = await prisma.interviewSession.findMany({
    where: {
      userId: interview.userId,
      status: "COMPLETED",
      overallScore: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { overallScore: true },
  });
  const scores = scoredInterviews.map((i) => i.overallScore!).reverse();
  const scoreTrendLast5: "improving" | "stable" | "declining" | null =
    scores.length < 2
      ? null
      : scores[scores.length - 1]! > scores[0]! + 5
        ? "improving"
        : scores[scores.length - 1]! < scores[0]! - 5
          ? "declining"
          : "stable";

  const mode = (interview as { mode?: string }).mode;
  const isDsaMode = mode === "LIVE_CODE";
  const isSystemDesign = mode === "LIVE_CANVAS";
  const isDiscussionMode = mode === "DISCUSSION";
  conn.isDsaMode = isDsaMode;
  conn.isSystemDesign = isSystemDesign;

  const route = resolveRoute(
    (interview as { interviewRound?: string | null }).interviewRound,
    mode,
  );
  console.log("[init] resolved route:", route);
  conn.isSqlMode = route.builder === "dsa_sql";
  conn.isQuantMode = route.builder === "quant_standard";
  conn.isHftMode = route.builder === "hft_coding";

  // Set silence tier based on round variant
  const roundLabel = (interview as { interviewRound?: string | null })
    .interviewRound;
  if (roundLabel) {
    const extendedRounds = [
      "Case Study",
      "Product Sense",
      "Client Presentation",
      "Quantitative Analysis",
      "Incident Response",
      "CI/CD & Automation",
      "Scenario",
    ];
    if (extendedRounds.includes(roundLabel)) {
      conn.silenceTier = "extended";
    } else if (roundLabel === "Design Critique") {
      conn.silenceTier = "design_critique";
    }
  }

  const roleCategory = ((interview as { roleCategory?: string | null })
    .roleCategory ?? null) as string | null;
  const isEngineeringDsaOrSd =
    roleCategory === "engineering" && (isDsaMode || isSystemDesign);

  // Engineering privilege: DSA and SD rounds always get 30 min
  const effectiveTimeLimitMs = isEngineeringDsaOrSd
    ? 1_800_000
    : userRole === "ADMIN" || userRole === "PRO"
      ? 1_800_000
      : 900_000;
  const durationMinutes = effectiveTimeLimitMs / 60_000;

  console.log(
    "[init] mode:",
    mode,
    "isDsaMode:",
    isDsaMode,
    "isSystemDesign:",
    isSystemDesign,
    "roleCategory:",
    roleCategory,
    "durationMinutes:",
    durationMinutes,
  );

  let pacingBudgets = VOICE_BUDGETS;
  if (isDsaMode) pacingBudgets = DSA_BUDGETS;
  else if (isSystemDesign || isDiscussionMode) pacingBudgets = SD_BUDGETS;
  conn.pacing = new PacingTracker(effectiveTimeLimitMs, pacingBudgets);

  let systemPrompt: string;

  if (route.mode === "LIVE_CODE") {
    const dsaSession = await prisma.dsaSession.findUnique({
      where: { interviewId: interview.id },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    const problems =
      dsaSession?.problems.map((p) => ({
        index: p.index,
        title: p.title,
        description: p.description,
        difficulty: p.difficulty,
      })) ?? [];

    // Fetch past DSA interview history
    const pastDsaInterviews = await prisma.interviewSession.findMany({
      where: {
        userId: interview.userId,
        mode: "LIVE_CODE",
        status: "COMPLETED",
        id: { not: interview.id },
        dsaSession: { isNot: null },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        dsaSession: {
          include: { problems: { orderBy: { index: "asc" } } },
        },
      },
    });
    const dsaHistoryEntries = pastDsaInterviews.map((iv) => ({
      date: iv.createdAt.toISOString().slice(0, 10),
      overallScore: iv.overallScore,
      problemScores:
        iv.dsaSession?.problems.map((p) => ({
          title: p.title,
          score: p.score,
        })) ?? [],
    }));
    const dsaScored = await prisma.interviewSession.findMany({
      where: {
        userId: interview.userId,
        mode: "LIVE_CODE",
        status: "COMPLETED",
        overallScore: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { overallScore: true },
    });
    const dsaScores = dsaScored.map((i) => i.overallScore!).reverse();
    const dsaScoreTrend: "improving" | "stable" | "declining" | null =
      dsaScores.length < 2
        ? null
        : dsaScores[dsaScores.length - 1]! > dsaScores[0]! + 5
          ? "improving"
          : dsaScores[dsaScores.length - 1]! < dsaScores[0]! - 5
            ? "declining"
            : "stable";

    systemPrompt = buildPromptFromRoute(route, {
      dsaQuestions: problems,
      dsaContext: {
        companyName: interview.companyName,
        roleTitle: (interview as { roleTitle?: string | null }).roleTitle,
        interviewRound: (interview as { interviewRound?: string | null })
          .interviewRound,
        position: interview.position,
        interviewDepth: (interview as { interviewDepth?: string | null })
          .interviewDepth,
        interviewStyle: (interview as { interviewStyle?: string | null })
          .interviewStyle,
        roleCategory,
        seniorityLabel,
        roleTopics: selectedRole?.topics ?? null,
        roleEvaluationCriteria: selectedRole?.evaluationCriteria ?? null,
        roleMustProbe: selectedRole?.mustProbe ?? null,
      },
      dsaHistory: {
        pastSessions: dsaHistoryEntries,
        scoreTrendLast5: dsaScoreTrend,
        mostImproved: skillProfile?.mostImprovedSkill ?? null,
        weakest: skillProfile?.weakestSkill ?? null,
      },
      dsaDurationMinutes: durationMinutes,
      memoryBrief,
    });
    console.log("[init] built DSA prompt:", systemPrompt.slice(0, 200));
  } else if (route.mode === "LIVE_CANVAS") {
    console.log("[init] building System Design prompt, round:", roundLabel);

    const canvasRoundLabels = [
      "Product Sense",
      "Design Critique",
      "Strategy & Vision",
    ];
    const isCanvasRound = roundLabel
      ? canvasRoundLabels.includes(roundLabel)
      : false;
    conn.isCanvasMode = isCanvasRound;

    const sdQuestion = await (isCanvasRound
      ? getCanvasQuestion(
          interview.id,
          roundLabel!,
          conn.interviewDepth,
          interview.interviewStyle ?? "PROFESSIONAL",
          roleCategory,
          interview.companyName ?? null,
          interview.position ?? null,
        )
      : getSdQuestion(
          interview.id,
          roleCategory,
          interview.companyName ?? null,
          interview.position ?? null,
        ));
    console.log("[init] sdQuestion found:", !!sdQuestion);
    const sdQuestions =
      isCanvasRound && sdQuestion && (sdQuestion as any).questionCount > 1
        ? [
            {
              title: sdQuestion.title,
              description: sdQuestion.description,
              fullBreakdown: sdQuestion.fullBreakdown,
            },
            {
              title: (sdQuestion as any).backupTitle,
              description: (sdQuestion as any).backupDescription,
              fullBreakdown: (sdQuestion as any).backupFullBreakdown,
            },
          ].filter((q) => q.title)
        : undefined;
    const sdInput: SystemDesignPromptInput & {
      sdQuestion?: any;
      sdQuestions?: any[];
      questionCount?: number;
    } = {
      position: interview.position,
      sdQuestion: sdQuestion ?? undefined,
      sdQuestions,
      questionCount: isCanvasRound
        ? ((sdQuestion as any)?.questionCount ?? 1)
        : 1,
      candidateName: interview.user.name,
      companyName: interview.companyName ?? null,
      companyCulture: companyConfig?.culture ?? null,
      companyInterviewerBehavior: companyConfig?.interviewerBehavior ?? null,
      companyEvaluationBiases: companyConfig?.evaluationBiases ?? null,
      roleTopics: selectedRole?.topics ?? null,
      roleEvaluationCriteria: selectedRole?.evaluationCriteria ?? null,
      roleMustProbe: selectedRole?.mustProbe ?? null,
      interviewRound:
        (interview as { interviewRound?: string | null }).interviewRound ??
        null,
      resumeText: interview.resume?.extractedText ?? null,
      jobDescription:
        (interview as { jobDescription?: string | null }).jobDescription ??
        null,
      githubUsername: github?.username ?? null,
      githubSummary: github?.summary ?? null,
      githubLanguages: (github?.languages as string[]) ?? [],
      githubProjects:
        (github?.projects as {
          name: string;
          description: string | null;
          stars: number;
          language: string | null;
        }[]) ?? [],
      interviewStyle: (interview.interviewStyle ??
        "PROFESSIONAL") as PromptInput["interviewStyle"],
      interviewDepth: conn.interviewDepth as PromptInput["interviewDepth"],
      durationMinutes,
      candidateHistory: pastInterviews.map((iv) => ({
        date: iv.createdAt.toISOString(),
        role: iv.roleTitle ?? iv.position,
        mode: (iv as { mode?: string }).mode,
        overallScore: iv.overallScore,
        strengths: (iv.summary?.strengths as string[]) ?? [],
        weaknesses: (iv.summary?.weaknesses as string[]) ?? [],
        summary: iv.summary?.summary ?? null,
      })),
      overallMostImproved: skillProfile?.mostImprovedSkill ?? null,
      overallWeakest: skillProfile?.weakestSkill ?? null,
      overallPatterns: (skillProfile?.commonPatterns as string[]) ?? [],
      scoreTrendLast5,
      roleCategory,
      seniorityLabel,
      memoryBrief,
    };
    systemPrompt = buildPromptFromRoute(route, { sdInput });
    console.log("[init] built SD prompt:", systemPrompt.slice(0, 200));
  } else if (route.mode === "DISCUSSION") {
    console.log("[init] building Discussion prompt, round:", roundLabel);
    conn.isCanvasMode = true;

    const sdQuestion = await getDiscussionQuestion(
      interview.id,
      roundLabel ?? "Case Study",
      conn.interviewDepth,
      interview.interviewStyle ?? "PROFESSIONAL",
      roleCategory,
      interview.companyName ?? null,
      interview.position ?? null,
    );
    console.log("[init] discussion question found:", !!sdQuestion);
    const sdQuestions =
      sdQuestion && (sdQuestion as any).questionCount > 1
        ? [
            {
              title: sdQuestion.title,
              description: sdQuestion.description,
              fullBreakdown: sdQuestion.fullBreakdown,
            },
            {
              title: (sdQuestion as any).backupTitle,
              description: (sdQuestion as any).backupDescription,
              fullBreakdown: (sdQuestion as any).backupFullBreakdown,
            },
          ].filter((q) => q.title)
        : undefined;
    const sdInput: SystemDesignPromptInput & {
      sdQuestion?: any;
      sdQuestions?: any[];
      questionCount?: number;
    } = {
      position: interview.position,
      sdQuestion: sdQuestion ?? undefined,
      sdQuestions,
      questionCount: (sdQuestion as any)?.questionCount ?? 1,
      candidateName: interview.user.name,
      companyName: interview.companyName ?? null,
      companyCulture: companyConfig?.culture ?? null,
      companyInterviewerBehavior: companyConfig?.interviewerBehavior ?? null,
      companyEvaluationBiases: companyConfig?.evaluationBiases ?? null,
      roleTopics: selectedRole?.topics ?? null,
      roleEvaluationCriteria: selectedRole?.evaluationCriteria ?? null,
      roleMustProbe: selectedRole?.mustProbe ?? null,
      interviewRound:
        (interview as { interviewRound?: string | null }).interviewRound ??
        null,
      resumeText: interview.resume?.extractedText ?? null,
      jobDescription:
        (interview as { jobDescription?: string | null }).jobDescription ??
        null,
      githubUsername: github?.username ?? null,
      githubSummary: github?.summary ?? null,
      githubLanguages: (github?.languages as string[]) ?? [],
      githubProjects:
        (github?.projects as {
          name: string;
          description: string | null;
          stars: number;
          language: string | null;
        }[]) ?? [],
      interviewStyle: (interview.interviewStyle ??
        "PROFESSIONAL") as PromptInput["interviewStyle"],
      interviewDepth: conn.interviewDepth as PromptInput["interviewDepth"],
      durationMinutes,
      candidateHistory: pastInterviews.map((iv) => ({
        date: iv.createdAt.toISOString(),
        role: iv.roleTitle ?? iv.position,
        mode: (iv as { mode?: string }).mode,
        overallScore: iv.overallScore,
        strengths: (iv.summary?.strengths as string[]) ?? [],
        weaknesses: (iv.summary?.weaknesses as string[]) ?? [],
        summary: iv.summary?.summary ?? null,
      })),
      overallMostImproved: skillProfile?.mostImprovedSkill ?? null,
      overallWeakest: skillProfile?.weakestSkill ?? null,
      overallPatterns: (skillProfile?.commonPatterns as string[]) ?? [],
      scoreTrendLast5,
      roleCategory,
      seniorityLabel,
      memoryBrief,
    };
    systemPrompt = buildPromptFromRoute(route, { sdInput });
    console.log("[init] built Discussion prompt:", systemPrompt.slice(0, 200));
  } else {
    const promptInput: PromptInput = {
      position: interview.position,
      candidateName: interview.user.name,
      resumeText: interview.resume?.extractedText ?? null,
      jobDescription:
        (interview as { jobDescription?: string | null }).jobDescription ??
        null,
      githubUsername: github?.username ?? null,
      githubSummary: github?.summary ?? null,
      githubLanguages: (github?.languages as string[]) ?? [],
      githubProjects:
        (github?.projects as {
          name: string;
          description: string | null;
          stars: number;
          language: string | null;
        }[]) ?? [],
      durationMinutes,
      interviewStyle: (interview.interviewStyle ??
        "PROFESSIONAL") as PromptInput["interviewStyle"],
      interviewDepth: conn.interviewDepth as PromptInput["interviewDepth"],
      companyName: interview.companyName ?? null,
      companyCulture: companyConfig?.culture ?? null,
      companyInterviewerBehavior: companyConfig?.interviewerBehavior ?? null,
      companyEvaluationBiases: companyConfig?.evaluationBiases ?? null,
      roleTopics: selectedRole?.topics ?? null,
      roleEvaluationCriteria: selectedRole?.evaluationCriteria ?? null,
      roleMustProbe: selectedRole?.mustProbe ?? null,
      interviewRound:
        (interview as { interviewRound?: string | null }).interviewRound ??
        null,
      candidateHistory: pastInterviews.map((iv) => ({
        date: iv.createdAt.toISOString(),
        role: iv.roleTitle ?? iv.position,
        mode: (iv as { mode?: string }).mode,
        overallScore: iv.overallScore,
        strengths: (iv.summary?.strengths as string[]) ?? [],
        weaknesses: (iv.summary?.weaknesses as string[]) ?? [],
        summary: iv.summary?.summary ?? null,
      })),
      overallMostImproved: skillProfile?.mostImprovedSkill ?? null,
      overallWeakest: skillProfile?.weakestSkill ?? null,
      overallPatterns: (skillProfile?.commonPatterns as string[]) ?? [],
      scoreTrendLast5,
      roleCategory,
      seniorityLabel,
      memoryBrief,
    };
    systemPrompt = buildPromptFromRoute(route, { voiceInput: promptInput });
  }

  const startFn = async () => {
    await startInterview(conn, systemPrompt, effectiveTimeLimitMs);
  };

  // Duplicate connection detection: if another WS already holds the slot
  // for this interview, close the old one (triggers cleanup & finalization),
  // then reject the new one with a clear error.
  const existingWs = conn.wsMap.get(conn.interviewId);
  if (existingWs && existingWs.readyState === 1 /* OPEN */) {
    console.log(
      `[init] duplicate WS for ${conn.interviewId} — keeping existing session, rejecting new`,
    );
    await conn.safeSend({
      error:
        "Interview already in progress in another tab. Please close the other tab and return to this one.",
    });
    conn.interviewId = null;
    conn.client.close();
    return;
  }

  // Race guard: if the interview is being cleaned up (old WS disconnected,
  // cleanup hasn't finished DB writes), reject the new connection to prevent
  // a fresh Gemini session from starting during finalization.
  if (conn.cleaningSet.has(conn.interviewId)) {
    console.log(
      `[init] rejecting WS for ${conn.interviewId} — cleanup in progress`,
    );
    await conn.safeSend({
      error: "Interview is ending, please wait.",
    });
    conn.interviewId = null;
    conn.client.close();
    return;
  }

  const slotOpen = await tryActivate(conn.interviewId);
  console.log(
    "[init] slotOpen:",
    slotOpen,
    "mode:",
    mode,
    "prompt length:",
    systemPrompt?.length,
  );
  if (slotOpen) {
    conn.wsMap.set(conn.interviewId, conn.client);
    conn.startCallbacks.set(conn.interviewId, startFn);
    await startInterview(conn, systemPrompt, effectiveTimeLimitMs);
    startHeartbeat(conn);
  } else {
    conn.isQueued = true;
    conn.wsMap.set(conn.interviewId, conn.client);
    conn.startCallbacks.set(conn.interviewId, startFn);
    const position = await queueEnqueue(conn.interviewId, userId);
    await conn.safeSend({ type: "queued", position });
    startHeartbeat(conn);
  }
}
