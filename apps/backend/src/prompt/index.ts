// Types
export type {
  CandidateHistoryEntry,
  PromptInput,
  SystemDesignPromptInput,
  PacingBudget,
} from "./types";

// Shared
export {
  buildDirectingDirective,
  buildEndSessionInstruction,
  buildInterruptionRules,
  buildCriticalConstraints,
  buildCompanyContext,
  buildRoleContext,
  buildRoundDirective,
  buildStyleDirective,
  buildDepthDirective,
  buildGeneralPrinciples,
  buildCandidateHistory,
  buildPacingDirective,
  VOICE_BUDGETS,
  DSA_BUDGETS,
  SD_BUDGETS,
} from "./shared";

// Generic (VOICE)
export { buildInterviewPrompt, buildScenarioPrompt } from "./generic";

// Quantitative Analysis
export { buildQuantPrompt } from "./quant";

// System Design
export {
  buildSystemDesignPrompt,
  buildSdInfraPrompt,
  buildSdDataArchPrompt,
  buildSdMlPrompt,
  buildProductCanvasPrompt,
  buildDesignCritiquePrompt,
  buildStrategyVisionPrompt,
  buildWhiteboardDirective,
} from "./sd";

// DSA
export {
  buildDsaSystemPrompt,
  buildDsaSqlPrompt,
  DSA_PHASES,
  DSA_EVALUATION_SCHEMA,
} from "./dsa";
export type { DsaPhase, DsaHistoryEntry } from "./dsa";

// Router
export { resolveRoute, buildPromptFromRoute } from "./router";
