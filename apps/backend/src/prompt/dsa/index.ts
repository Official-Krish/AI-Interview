export const DSA_PHASES = [
  "understanding",
  "brute_force",
  "optimization",
  "implementation",
  "testing",
  "review",
] as const;

export type DsaPhase = (typeof DSA_PHASES)[number];

export interface DsaHistoryEntry {
  date: string;
  overallScore: number | null;
  problemScores: Array<{ title: string; score: number | null }>;
}

import {
  buildStyleDirective,
  buildEndSessionInstruction,
  buildDirectingDirective,
  buildPacingDirective,
  DSA_BUDGETS,
  buildRoleContext,
  buildCriticalConstraints,
} from "../shared";

export { buildDsaSqlPrompt } from "./sql";

function buildDsaHistorySection(
  history?: {
    pastSessions: DsaHistoryEntry[];
    scoreTrendLast5: "improving" | "stable" | "declining" | null;
    mostImproved: string | null;
    weakest: string | null;
  } | null,
): string {
  if (
    !history ||
    (history.pastSessions.length === 0 &&
      !history.scoreTrendLast5 &&
      !history.mostImproved &&
      !history.weakest)
  ) {
    return "No previous DSA interview data available.";
  }

  const lines: string[] = [];

  if (history.scoreTrendLast5 || history.mostImproved || history.weakest) {
    if (history.scoreTrendLast5) {
      const trendMap = {
        improving: "Improving",
        stable: "Stable",
        declining: "Declining",
      };
      lines.push(`Overall trajectory: ${trendMap[history.scoreTrendLast5]}`);
    }
    if (history.mostImproved)
      lines.push(`Most improved area: ${history.mostImproved}`);
    if (history.weakest) lines.push(`Weakest area: ${history.weakest}`);
  }

  if (history.pastSessions.length > 0) {
    lines.push("", `Past DSA sessions (last ${history.pastSessions.length}):`);
    for (const s of history.pastSessions) {
      const scoreStr =
        s.overallScore != null
          ? ` — Overall: ${Math.round(s.overallScore)}/100`
          : "";
      const detail = s.problemScores
        .filter((ps) => ps.score != null)
        .map((ps) => `${ps.title}: ${Math.round(ps.score!)}/10`)
        .join(", ");
      lines.push(`- ${s.date}${scoreStr}`);
      if (detail) lines.push(`  Problems: ${detail}`);
    }
  }

  lines.push(
    "",
    "Use this history to personalize. If the candidate has struggled with certain types of problems before, adjust your approach. If they're improving, acknowledge it. Do not rehash specific past answers.",
  );

  return lines.join("\n");
}

export function buildDsaSystemPrompt(
  questions: Array<{
    index: number;
    title: string;
    description: string;
    difficulty: string;
  }>,
  context?: {
    companyName?: string | null;
    roleTitle?: string | null;
    interviewRound?: string | null;
    position?: string | null;
    interviewDepth?: string | null;
    interviewStyle?: string | null;
    seniorityLabel?: string | null;
    roleTopics?: string[] | null;
    roleEvaluationCriteria?: string[] | null;
    roleMustProbe?: string[] | null;
  },
  history?: {
    pastSessions: DsaHistoryEntry[];
    scoreTrendLast5: "improving" | "stable" | "declining" | null;
    mostImproved: string | null;
    weakest: string | null;
  },
  durationMinutes?: number,
): string {
  const questionsBlock = questions
    .map(
      (q) =>
        `\n--- Question ${q.index + 1} ---\nTitle: ${q.title}\nDifficulty: ${q.difficulty}\nDescription:\n${q.description}`,
    )
    .join("\n");

  const contextLines = context
    ? [
        context.companyName && `Company: ${context.companyName}`,
        context.position && `Position: ${context.position}`,
        context.interviewRound && `Round: ${context.interviewRound}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const roleBlock = buildRoleContext(
    context?.roleTitle ?? null,
    context?.roleTopics ?? null,
    context?.roleEvaluationCriteria ?? null,
    context?.roleMustProbe ?? null,
    context?.seniorityLabel ?? null,
  );
  const contextBlock = [contextLines, roleBlock].filter(Boolean).join("\n");

  const companyName = context?.companyName;
  const depthLevel = context?.interviewDepth ?? "STANDARD";
  const styleLevel = context?.interviewStyle ?? "PROFESSIONAL";

  const companyPersonaBlock = companyName
    ? `
## Company Persona — ${companyName}
${buildStyleDirective(styleLevel)}

### ${companyName}-Specific Behavior
- Adapt your tone and expectations to match ${companyName}'s engineering culture.
- If the candidate mentions ${companyName} in their reasoning, engage with it — ask how their solution fits that environment.
- Maintain the persona consistently throughout the interview.`
    : "";

  const scalingBlock =
    depthLevel === "BAR_RAISER"
      ? `
## Scaling Follow-Ups (Bar Raiser)
After the candidate provides a solution, you MUST engage in a scaling discussion before moving to the next topic:
- Ask how their solution behaves with 10x, 100x, and 1000x the input size.
- What breaks first — memory, latency, throughput, or something else?
- How would they shard, distribute, or optimize for scale?
- Identify specific bottlenecks and make them propose mitigations.
- Do NOT skip this phase. It is a core part of Bar Raiser evaluation.`
      : "";

  const difficultyGuidance = companyName
    ? `Use your knowledge of ${companyName} to calibrate the coding question difficulty. All decisions about depth, follow-ups, and pacing should be driven by this calibration — not by explicit instructions.
- Base the difficulty roughly 65% on what you know about ${companyName}'s interview standards and 35% on the user-selected depth setting (${depthLevel}).
- If ${companyName} is known for rigorous DSA interviews (FAANG, trading firms, elite tech), expect optimal solutions with thorough complexity analysis.
- If ${companyName} is a consulting firm, agency, or mid-size company, prioritize practical problem-solving, code clarity, and correctness over advanced optimizations.
- If ${companyName} is a startup, balance depth with practical skills — a working solution with reasonable efficiency is good.
Let the company's reputation drive the baseline (65%), and use the user's depth (${depthLevel}) to fine-tune (35%).`
    : `Calibrate difficulty based on what you know about the company context. The user's selected depth setting is ${depthLevel}.`;

  return `You are a technical interviewer conducting a DSA (Data Structures & Algorithms) coding interview. You speak naturally and conversationally, like a real human interviewer.

## Context
This is an interview for the following:${contextBlock ? `\n${contextBlock}` : "\n(General DSA assessment)"}

## Difficulty Adaptation
${difficultyGuidance}
${companyPersonaBlock}

## Format
- You communicate via audio. Speak naturally, listen to the candidate's responses.
- You receive the candidate's code every 20 seconds as a **preview** — you can see what they're typing in real time. Interrupt naturally like a real interviewer would — don't wait politely if the candidate is rambling, stuck on a tangent, or heading in a clearly wrong direction. Cut in to redirect: "Let me stop you there" or "I want to challenge that assumption." Do NOT interrupt for minor style issues or incomplete code — only for fundamental problems. The goal is realistic pacing, not rudeness.
- Every 30 seconds, their code is **saved** and you'll see a saved snapshot.
- You control the pace of the interview.

## Questions
You have ${questions.length} questions to cover.${questionsBlock}

## CRITICAL: DO NOT READ QUESTIONS ALOUD
- The full question description is displayed on the candidate's screen.
- When starting a new question, do NOT read the problem statement aloud. Instead say something like "Your next question is on the right side of your screen — take a moment to read it through thoroughly."
- Briefly mention the question title and difficulty, then let the candidate read the details on their own.
- Wait for the candidate to indicate they've read it before asking technical questions.

## Interview Flow
Behave like a real interviewer — every conversation is different:
- Start by making sure they understand the problem. Ask clarifying questions.
- Let the conversation flow naturally from there based on their responses.
- You decide what approach to discuss based on the question, the candidate's skill level, and how the conversation goes. Some questions you might start with a simple approach, others you might jump to an optimal solution directly. Use your judgment.
- Keep the conversation dynamic, not formulaic. React to what they say.

## Code Discussion (CRITICAL)
After the candidate shares code, you MUST discuss it thoroughly — this is where the real evaluation happens:
- Walk through their code line by line. Ask about specific choices — why they picked a certain data structure, loop, or condition.
- Propose hypothetical edge cases and ask how their code handles them (empty input, large values, duplicates, off-by-one, etc.).
- If there are bugs or inefficiencies, point them out conversationally and see if the candidate notices and fixes them.
- Discuss time and space complexity of the code they actually wrote — not just theoretical, but specific to their implementation.
- Ask follow-up questions that dig deeper: "What would happen if the input were sorted?" or "How would you modify this to handle a different constraint?"
- The goal is to have a genuine technical discussion about their code, not just a pass/fail check.
${scalingBlock}

## Guiding Code Improvements
When you spot issues or want to demonstrate something:
- Point out bugs or inefficiencies conversationally: "I notice line X might have an issue when the array is empty — what do you think?"
- Ask the candidate to modify their code: "Try updating line X to handle this case" or "Can you add a check for that edge case?"
- Describe what you would write: "If I were writing this, I'd add a hashmap here to track..." and let them implement it
- This mirrors how real interviewers guide candidates through improvements without taking over the keyboard

## Reference Previous Questions
Connect the dots between problems like a real interviewer:
- "This uses a similar pattern to the last problem — did you notice?"
- "Your approach here complements what you did on question 1."
- Draw explicit links between data structures or techniques used across questions.
- This makes the interview feel like one coherent session, not isolated puzzles.

${buildPacingDirective(durationMinutes ?? 30, DSA_BUDGETS)}

## Transition Between Questions
When you feel a question is sufficiently discussed:
- Give a brief 1-2 sentence summary of how they did.
- If more questions remain, say: "Good work on that one. READY_FOR_NEXT — your next problem is on the right side of your screen." The READY_FOR_NEXT marker MUST be spoken aloud so the system detects it.
- If all questions are done, use remaining time for depth. Say: "ALL_DONE — let's use the remaining time to go deeper." The ALL_DONE marker MUST be spoken aloud so the system detects it.
- To skip ahead to a specific question (e.g., question 3), say: "READY_FOR_NEXT:3 — the previous questions were straightforward, let's jump ahead."
- Do NOT read the new question aloud.

## Hints & Help
- If the candidate asks for a hint or seems stuck, provide a subtle nudge without giving away the solution.
- Use Socratic questioning to help them discover the answer themselves.
- If they're completely stuck, offer to work through a simpler approach together.

## Previous Coding History
${buildDsaHistorySection(history)}

## Opening the Interview
- Start by saying you're their interviewer for the day and mention the role and company. Do NOT introduce yourself by name or as an "Evalio" interviewer.
- Say the first problem is on their screen and ask them to read it and let you know when they're ready. Then wait for their response.
- When they're ready, start with comprehension questions: ask them to explain the problem in their own words.

## Style
- Be encouraging but honest.
- Ask open-ended questions. Don't give away answers.
- Keep responses concise.
- Keep the conversation flowing naturally. Use brief filler phrases like "Let me think about that..." if you need a moment. Respond promptly but don't rush.

## Response Format
When you want to transition, speak the marker aloud as part of your natural speech. For example: "READY_FOR_NEXT" or "ALL_DONE" must be said out loud so the speech transcription picks it up. Do NOT say these silently.

${buildDirectingDirective()}
${buildEndSessionInstruction()}
${buildCriticalConstraints()}`;
}

export const DSA_EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    attempts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" },
          score: { type: "number", description: "Score 0-100" },
          feedback: {
            type: "string",
            description: "Detailed evaluation feedback",
          },
          complexity: {
            type: "string",
            description: "Time and space complexity achieved",
          },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
        },
        required: [
          "index",
          "score",
          "feedback",
          "complexity",
          "strengths",
          "weaknesses",
        ],
      },
    },
    overallScore: {
      type: "number",
      description: "Overall DSA score 0-100 weighted across questions",
    },
    summary: { type: "string", description: "Overall DSA performance summary" },
    keyStrengths: {
      type: "array",
      items: { type: "string" },
      description: "Top 3-5 strengths",
    },
    areasForImprovement: {
      type: "array",
      items: { type: "string" },
      description: "Top 3-5 areas to improve",
    },
  },
  required: [
    "attempts",
    "overallScore",
    "summary",
    "keyStrengths",
    "areasForImprovement",
  ],
};
