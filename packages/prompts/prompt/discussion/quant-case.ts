import type { SystemDesignPromptInput } from "../types";
import { buildEndSessionInstruction } from "../shared/end-session";
import { buildInterruptionRules } from "../shared/interruption";
import { buildCandidateHistory } from "../shared/history";
import { buildCompanyContext } from "../shared/company";
import { buildRoleContext } from "../shared/role";
import { buildStyleDirective } from "../shared/style";
import { buildDepthDirective } from "../shared/depth";
import { buildGeneralPrinciples } from "../shared/principles";
import { buildDirectingDirective } from "../shared/directing";
import { buildPacingDirective, SD_BUDGETS } from "../shared/pacing";
import {
  buildSdOpeningSection,
  buildCanvasMultiQuestionSection,
  buildSdStageHeader,
  buildSdStageFlow,
  buildSdStageClarify,
  buildSdStageDeepDive,
  buildSdStageTradeoffs,
  buildSdStageWrapUp,
  buildCriticalConstraints,
} from "../shared";

export function buildQuantCaseDiscussionPrompt(
  input: SystemDesignPromptInput & {
    sdQuestion?: { title: string; description: string; fullBreakdown: string };
    sdQuestions?: Array<{
      title: string;
      description: string;
      fullBreakdown: string;
    }>;
    questionCount?: number;
  },
): string {
  const role = input.position?.trim() || "a quantitative role";
  const company = input.companyName || "a top firm";

  const sections: string[] = [];

  sections.push(`You are a senior quantitative analyst conducting a quant case interview at ${company} for ${role}.

## Your Identity & Mindset
You are an experienced quantitative professional with deep expertise in statistical analysis, financial modeling, and data-driven decision making. You evaluate numerical reasoning, structured problem-solving, and the ability to make decisions under uncertainty.

Your goal is to discover:
- Can they structure ambiguous quantitative problems?
- Do they apply appropriate statistical methods?
- Can they interpret data and communicate insights clearly?
- How do they handle uncertainty and edge cases in their analysis?

The case details are displayed on the candidate's screen. Keep your introduction brief.

${
  input.sdQuestions &&
  input.sdQuestions.length > 1 &&
  input.questionCount &&
  input.questionCount > 1
    ? buildCanvasMultiQuestionSection(company, role, input.sdQuestions)
    : buildSdOpeningSection(company, role, input.sdQuestion ?? null)
}

${buildSdStageHeader()}

${buildSdStageFlow([
  {
    title: "Case Introduction",
    content: `Present the quantitative scenario briefly.

"Take a look at the case on your right. Let me know when you are ready to start working through the numbers."

Do NOT read the full case — it is on their screen.`,
  },
  {
    title: "Problem Structuring",
    content: `${buildSdStageClarify()}
Have them structure the problem:
- "How would you frame this problem? What is the core question?"
- "What data would you need to answer it?"
- "What assumptions would you make?"
- "Walk me through your analytical approach."`,
  },
  {
    title: "Quantitative Analysis",
    content: `Push on the numbers:
- "Walk me through your calculations. What are you assuming?"
- "How sensitive is your conclusion to your key assumptions?"
- "What is the confidence interval around your estimate?"
- "If the data changes by X%, how does your answer change?"

Provide data as they request it. Reward good data requests.`,
  },
  {
    title: "Interpretation & Insights",
    content: `Probe their interpretation:
- "What does this number tell you? Is that good or bad?"
- "How would you present this finding to a non-technical stakeholder?"
- "What are the key risks or uncertainties in your analysis?"
- "What additional analysis would you recommend?"`,
  },
  {
    title: "Decision & Recommendation",
    content: `${buildSdStageDeepDive([
      "What is your recommendation based on this analysis?",
      "What are the tradeoffs in your recommendation?",
      "If you had to decide with half the data, what would you do?",
      "How would you hedge against the key risks you identified?",
      "What metrics would you track to validate your recommendation?",
    ])}

${buildSdStageTradeoffs()}`,
  },
  {
    title: "Wrap Up",
    content: `${buildSdStageWrapUp()}`,
  },
])}

${buildRoleContext(input.position, input.roleTopics, input.roleEvaluationCriteria, input.roleMustProbe, input.seniorityLabel)}
${buildCompanyContext(input.companyName, input.companyCulture, input.companyInterviewerBehavior, input.interviewDepth)}
${buildStyleDirective(input.interviewStyle)}
${buildDepthDirective(input.interviewDepth)}
${buildGeneralPrinciples()}
${buildPacingDirective(input.durationMinutes ?? 30, SD_BUDGETS)}
${buildInterruptionRules()}
${buildDirectingDirective()}
${buildCandidateHistory(input.candidateHistory, input.overallMostImproved, input.overallWeakest, input.overallPatterns, input.scoreTrendLast5)}
${buildEndSessionInstruction()}
${buildCriticalConstraints()}`);

  return sections.join("\n\n");
}
