import type { InterviewMode } from "@evalio/shared";
import { buildInterviewPrompt, buildScenarioPrompt } from "./generic";
import type { PromptInput } from "./types";
import { buildDsaSystemPrompt, buildDsaSqlPrompt } from "./dsa";
import {
  buildSystemDesignPrompt,
  buildSdInfraPrompt,
  buildSdDataArchPrompt,
  buildSdMlPrompt,
  buildProductCanvasPrompt,
  buildDesignCritiquePrompt,
  buildStrategyVisionPrompt,
  buildMobileArchitecturePrompt,
  buildHardwareDesignPrompt,
} from "./sd";
import {
  buildCaseStudyDiscussionPrompt,
  buildThreatModelingDiscussionPrompt,
  buildPaperCritiqueDiscussionPrompt,
  buildQuantCaseDiscussionPrompt,
  buildMockPitchDiscussionPrompt,
} from "./discussion";
import { buildQuantPrompt } from "./quant";
import {
  buildHftQuantPrompt,
  buildHftSdPrompt,
  buildHftCodingPrompt,
} from "./hft";
import type { SystemDesignPromptInput } from "./types";

interface RoundRoute {
  mode: InterviewMode;
  builder:
    | "dsa_standard"
    | "dsa_sql"
    | "sd_standard"
    | "sd_infra"
    | "sd_data_arch"
    | "sd_ml"
    | "sd_product"
    | "sd_design_critique"
    | "sd_strategy"
    | "sd_mobile_arch"
    | "sd_hardware"
    | "discussion_case_study"
    | "discussion_threat_modeling"
    | "discussion_paper_critique"
    | "discussion_quant_case"
    | "discussion_mock_pitch"
    | "quant_standard"
    | "voice_standard"
    | "voice_scenario"
    | "hft_quant"
    | "hft_coding"
    | "hft_system_design";
}

const ROUTER: Record<string, RoundRoute> = {
  "Coding Round (DSA)": { mode: "LIVE_CODE", builder: "dsa_standard" },
  "SQL & Analytics": { mode: "LIVE_CODE", builder: "dsa_sql" },
  "System Design": { mode: "LIVE_CANVAS", builder: "sd_standard" },
  "Infrastructure Design": { mode: "LIVE_CANVAS", builder: "sd_infra" },
  "Data Architecture": { mode: "LIVE_CANVAS", builder: "sd_data_arch" },
  "ML System Design": { mode: "LIVE_CANVAS", builder: "sd_ml" },
  "Case Study": { mode: "DISCUSSION", builder: "discussion_case_study" },
  "Product Sense": { mode: "LIVE_CANVAS", builder: "sd_product" },
  "Design Critique": { mode: "LIVE_CANVAS", builder: "sd_design_critique" },
  "Client Presentation": { mode: "VOICE", builder: "voice_scenario" },
  "Quantitative Analysis": { mode: "LIVE_CODE", builder: "quant_standard" },
  "Incident Response": { mode: "VOICE", builder: "voice_scenario" },
  "CI/CD & Automation": { mode: "VOICE", builder: "voice_scenario" },
  "Leadership / Behavioral": { mode: "VOICE", builder: "voice_standard" },
  "Behavioral / Experience": { mode: "VOICE", builder: "voice_standard" },
  "Technical Deep Dive": { mode: "VOICE", builder: "voice_standard" },
  "Strategy & Vision": { mode: "LIVE_CANVAS", builder: "sd_strategy" },
  "Threat Modeling": {
    mode: "DISCUSSION",
    builder: "discussion_threat_modeling",
  },
  "Paper Critique": {
    mode: "DISCUSSION",
    builder: "discussion_paper_critique",
  },
  "Quantitative Case": { mode: "DISCUSSION", builder: "discussion_quant_case" },
  "Mock Pitch": { mode: "DISCUSSION", builder: "discussion_mock_pitch" },
  "Mobile Architecture": { mode: "LIVE_CANVAS", builder: "sd_mobile_arch" },
  "Hardware Design": { mode: "LIVE_CANVAS", builder: "sd_hardware" },
  "Quantitative & Probability": { mode: "VOICE", builder: "hft_quant" },
  "Low-Latency C++ Coding": { mode: "LIVE_CODE", builder: "hft_coding" },
  "Low-Latency System Design": {
    mode: "LIVE_CANVAS",
    builder: "hft_system_design",
  },
  "Behavioral / HFT Fit": { mode: "VOICE", builder: "voice_standard" },
};

const MODE_DEFAULTS: Record<string, RoundRoute> = {
  LIVE_CODE: { mode: "LIVE_CODE", builder: "dsa_standard" },
  LIVE_CANVAS: { mode: "LIVE_CANVAS", builder: "sd_standard" },
  DISCUSSION: { mode: "DISCUSSION", builder: "discussion_case_study" },
  VOICE: { mode: "VOICE", builder: "voice_standard" },
};

export interface ResolvedRoute {
  mode: InterviewMode;
  builder: string;
}

export function resolveRoute(
  interviewRound: string | null | undefined,
  mode: string | null | undefined,
): ResolvedRoute {
  const route = interviewRound ? ROUTER[interviewRound] : undefined;
  if (route) return route;
  const modeKey = mode ?? "VOICE";
  return MODE_DEFAULTS[modeKey] ?? MODE_DEFAULTS["VOICE"]!;
}

export function buildPromptFromRoute(
  route: ResolvedRoute,
  params: {
    dsaQuestions?: Array<{
      index: number;
      title: string;
      description: string;
      difficulty: string;
    }>;
    dsaContext?: any;
    dsaHistory?: any;
    dsaDurationMinutes?: number;
    sdInput?: SystemDesignPromptInput & { sdQuestion?: any };
    voiceInput?: PromptInput;
  },
): string {
  switch (route.builder) {
    case "dsa_standard":
      return buildDsaSystemPrompt(
        params.dsaQuestions ?? [],
        params.dsaContext,
        params.dsaHistory,
        params.dsaDurationMinutes,
      );
    case "dsa_sql":
      return buildDsaSqlPrompt(
        params.dsaQuestions ?? [],
        params.dsaContext,
        params.dsaHistory,
        params.dsaDurationMinutes,
      );
    case "sd_infra":
      return buildSdInfraPrompt(params.sdInput!);
    case "sd_data_arch":
      return buildSdDataArchPrompt(params.sdInput!);
    case "sd_ml":
      return buildSdMlPrompt(params.sdInput!);
    case "sd_product":
      return buildProductCanvasPrompt(params.sdInput!);
    case "sd_design_critique":
      return buildDesignCritiquePrompt(params.sdInput!);
    case "sd_strategy":
      return buildStrategyVisionPrompt(params.sdInput!);
    case "discussion_case_study":
      return buildCaseStudyDiscussionPrompt(params.sdInput!);
    case "discussion_threat_modeling":
      return buildThreatModelingDiscussionPrompt(params.sdInput!);
    case "discussion_paper_critique":
      return buildPaperCritiqueDiscussionPrompt(params.sdInput!);
    case "discussion_quant_case":
      return buildQuantCaseDiscussionPrompt(params.sdInput!);
    case "discussion_mock_pitch":
      return buildMockPitchDiscussionPrompt(params.sdInput!);
    case "quant_standard":
      return buildQuantPrompt({
        companyName:
          params.sdInput?.companyName ?? params.dsaContext?.companyName,
        position: params.sdInput?.position ?? params.dsaContext?.position,
        interviewRound:
          params.sdInput?.interviewRound ?? params.dsaContext?.interviewRound,
        interviewDepth:
          params.sdInput?.interviewDepth ?? params.dsaContext?.interviewDepth,
        interviewStyle:
          params.sdInput?.interviewStyle ?? params.dsaContext?.interviewStyle,
        seniorityLabel:
          params.sdInput?.seniorityLabel ?? params.dsaContext?.seniorityLabel,
        roleTopics: params.sdInput?.roleTopics ?? params.dsaContext?.roleTopics,
        roleEvaluationCriteria:
          params.sdInput?.roleEvaluationCriteria ??
          params.dsaContext?.roleEvaluationCriteria,
        roleMustProbe:
          params.sdInput?.roleMustProbe ?? params.dsaContext?.roleMustProbe,
        durationMinutes:
          params.sdInput?.durationMinutes ?? params.dsaDurationMinutes,
        companyCulture: params.sdInput?.companyCulture,
        companyInterviewerBehavior: params.sdInput?.companyInterviewerBehavior,
        candidateHistory: params.sdInput?.candidateHistory,
        overallMostImproved: params.sdInput?.overallMostImproved,
        overallWeakest: params.sdInput?.overallWeakest,
        overallPatterns: params.sdInput?.overallPatterns,
        scoreTrendLast5: params.sdInput?.scoreTrendLast5,
        problems: params.dsaQuestions?.map((q) => ({
          index: q.index,
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
        })),
      });
    case "voice_scenario":
      return buildScenarioPrompt(params.voiceInput!);
    case "sd_mobile_arch":
      return buildMobileArchitecturePrompt(params.sdInput!);
    case "sd_hardware":
      return buildHardwareDesignPrompt(params.sdInput!);
    case "hft_quant":
      return buildHftQuantPrompt({
        companyName:
          params.sdInput?.companyName ?? params.dsaContext?.companyName,
        position: params.sdInput?.position ?? params.dsaContext?.position,
        interviewRound:
          params.sdInput?.interviewRound ?? params.dsaContext?.interviewRound,
        interviewDepth:
          params.sdInput?.interviewDepth ?? params.dsaContext?.interviewDepth,
        interviewStyle:
          params.sdInput?.interviewStyle ?? params.dsaContext?.interviewStyle,
        seniorityLabel:
          params.sdInput?.seniorityLabel ?? params.dsaContext?.seniorityLabel,
        roleTopics: params.sdInput?.roleTopics ?? params.dsaContext?.roleTopics,
        roleEvaluationCriteria:
          params.sdInput?.roleEvaluationCriteria ??
          params.dsaContext?.roleEvaluationCriteria,
        roleMustProbe:
          params.sdInput?.roleMustProbe ?? params.dsaContext?.roleMustProbe,
        durationMinutes:
          params.sdInput?.durationMinutes ?? params.dsaDurationMinutes,
        companyCulture: params.sdInput?.companyCulture,
        companyInterviewerBehavior: params.sdInput?.companyInterviewerBehavior,
        candidateHistory: params.sdInput?.candidateHistory,
        overallMostImproved: params.sdInput?.overallMostImproved,
        overallWeakest: params.sdInput?.overallWeakest,
        overallPatterns: params.sdInput?.overallPatterns,
        scoreTrendLast5: params.sdInput?.scoreTrendLast5,
      });
    case "hft_coding":
      return buildHftCodingPrompt(
        params.dsaQuestions ?? [],
        params.dsaContext,
        params.dsaHistory,
        params.dsaDurationMinutes,
      );
    case "hft_system_design":
      return buildHftSdPrompt(params.sdInput!);
    case "sd_standard":
      return buildSystemDesignPrompt(params.sdInput!);
    case "voice_standard":
    default:
      return buildInterviewPrompt(params.voiceInput!);
  }
}
