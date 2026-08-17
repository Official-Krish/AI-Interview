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
  buildMemoryBriefSection,
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

// Profile analysis
export { buildProfileAnalysisPrompt } from "./profile";

// Generation prompts
export {
  ROUND_GENERATION_PROMPTS,
  CANVAS_QUESTION_SCHEMA_SINGLE,
  CANVAS_QUESTION_SCHEMA_DOUBLE,
  DISCUSSION_GENERATION_PROMPTS,
  DISCUSSION_QUESTION_SCHEMA_SINGLE,
  DISCUSSION_QUESTION_SCHEMA_DOUBLE,
  CASE_STUDY_PROMPT,
  CASE_STUDY_QUESTION_SCHEMA_SINGLE,
  CASE_STUDY_QUESTION_SCHEMA_DOUBLE,
  buildSdGenerationPrompt,
  buildQuantGenerationPrompt,
  buildSqlGenerationPrompt,
  buildCompanyGenerationPrompt,
} from "./generation";

// Evaluation prompts
export { EVALUATION_PROMPT, SYSTEM_DESIGN_EVALUATION_SCHEMA } from "./evaluate";

// Constants
export { FAILURE_SIGNALS } from "./constants/signals";
export type { FailureSignalCode } from "./constants/signals";
