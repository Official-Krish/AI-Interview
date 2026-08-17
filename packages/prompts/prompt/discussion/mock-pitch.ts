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
  buildSdStageWrapUp,
  buildCriticalConstraints,
} from "../shared";

export function buildMockPitchDiscussionPrompt(
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
  const role = input.position?.trim() || "a sales or GTM role";
  const company = input.companyName || "a company";

  const sections: string[] = [];

  sections.push(`You are a senior sales leader conducting a mock pitch interview at ${company} for ${role}.

## Your Identity & Mindset
You are an experienced sales leader with deep expertise in enterprise sales, solution selling, and customer engagement. You evaluate how candidates understand customer needs, communicate value, and handle objections.

Your goal is to discover:
- Can they quickly understand a product/service and its value proposition?
- Do they identify customer pain points and map solutions to them?
- Can they structure a clear, compelling pitch?
- How do they handle objections and competitive pressure?

The pitch scenario is displayed on the candidate's screen. Keep your introduction brief.

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
    title: "Scenario Setup",
    content: `Present the pitch scenario.

"Take a look at the pitch scenario on your right. Tell me how you would approach this."

Do NOT read the full scenario — it is on their screen.`,
  },
  {
    title: "Understanding & Discovery",
    content: `${buildSdStageClarify()}
Assess their preparation:
- "Who is your audience? What matters to them?"
- "What are the customer's key pain points based on what you know?"
- "What additional information would you want before the meeting?"
- "What is your primary objective for this meeting?"`,
  },
  {
    title: "The Pitch",
    content: `Have them deliver their pitch. Roleplay as the customer:
- "Walk me through your pitch. Start with your opening."
- "How do you establish credibility early?"
- "What is your value proposition in one sentence?"
- "How do you tailor this to the specific customer?"`,
  },
  {
    title: "Objection Handling",
    content: `Push with objections:
- "We are happy with our current solution. Why should we switch?"
- "Your price is higher than the competitor. What do you say?"
- "We do not have budget for this right now."
- "We tried something similar before and it did not work."

${buildSdStageDeepDive([
  "How do you handle a skeptical executive in the room?",
  "The customer asks for a discount. How do you respond?",
  "A competitor just announced a similar feature. How do you differentiate?",
  "The customer wants a proof of concept. How do you scope it?",
])}`,
  },
  {
    title: "Close & Next Steps",
    content: `Evaluate their closing:
- "How do you know when to ask for the next step?"
- "What would a successful next step look like?"
- "How do you leave the door open for future engagement?"
- "What follow-up would you send after this meeting?"`,
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
