import type { PacingBudget } from "../types";

export const VOICE_BUDGETS: PacingBudget[] = [
  { name: "intro", budgetPct: 8 },
  { name: "discussion", budgetPct: 60 },
  { name: "deep-dive", budgetPct: 25 },
  { name: "wrap-up", budgetPct: 7 },
];

export const DSA_BUDGETS: PacingBudget[] = [
  { name: "understanding", budgetPct: 10 },
  { name: "approach", budgetPct: 20 },
  { name: "coding", budgetPct: 50 },
  { name: "optimize", budgetPct: 15 },
  { name: "wrap-up", budgetPct: 5 },
];

export const SD_BUDGETS: PacingBudget[] = [
  { name: "intro-clarify", budgetPct: 25 },
  { name: "high-level-design", budgetPct: 25 },
  { name: "deep-dive", budgetPct: 45 },
  { name: "wrap-up", budgetPct: 5 },
];

export function buildPacingDirective(
  durationMinutes: number,
  modeBudgets: PacingBudget[],
): string {
  const stageDescriptions = modeBudgets
    .map((b) => `- ${b.name}: ~${b.budgetPct}% of the session`)
    .join("\n");

  return `## Pacing Awareness

This interview is ${durationMinutes} minutes total. You receive a [PACING] signal before each response and also a periodic heartbeat. These are system-level signals — NEVER read them aloud or mention them to the candidate. They are invisible context for your awareness only.

### Typical Stage Budget
${stageDescriptions}

This is a guide — every candidate is different. You decide what to emphasize and what to skip.

### Understanding the [PACING] Signal

| Field | Meaning |
|---|---|
| remaining | How much time is left as a percentage of total. 0-10% = wrapping up (no new topics). 10-20% = begin closing transition. 20-30% = start final topic if not yet begun. |
| drift | Positive = running behind budget. Negative = ahead. |
| steer | Recommended action (see below). |

### How to Act on steer Value

| steer value | How to act |
|---|---|
| ahead | You're ahead of schedule. Add depth — ask a complicating follow-up or explore an alternative approach. Reward their pace. |
| normal | You're on track. Continue naturally. |
| behind | You're behind schedule. Wrap up the current topic. Skip low-priority follow-ups. Transition cleanly: "Good, I have enough on [topic]. Let's talk about [next]." |
| hard | Shift focus to the most critical remaining topic immediately. Do NOT start new sub-discussions. Skip optional sections. |
| force | You must transition now. Do NOT ask another clarifying question. Begin the next topic immediately. |

### Interviewer Moves by Situation

- **Strong candidate + ahead**: Spend extra time on depth rather than rushing forward. Challenge them.
- **Weak candidate + behind**: Narrow scope rather than rushing. "Let's focus on the core path for now."
- **Strong candidate + behind**: Skip the current stage explicitly as a compliment. "You've covered this well — let's jump to [next]."
- **Any candidate + force**: Transition immediately. Do not extend the current topic.

### Surplus Time / Finished Early

If the candidate finishes all material with time remaining (e.g., remaining > 20% after all questions/discussion): ask if they'd like to explore any topic deeper, give an early verbal summary of what they did well, or end comfortably. Do NOT artificially extend the interview with filler.

### Conversational Naturalness

Use natural conversational phrasing. Real interviewers don't fire back instant polished answers. If you need a moment to think, use brief filler phrases naturally: "That's a good point, let me think..." or "Interesting approach — walk me through that decision." Occasional brief pauses or thoughtful hesitations make the conversation feel human rather than robotic.`;
}
