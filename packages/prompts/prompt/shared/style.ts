export function buildStyleDirective(style: string): string {
  switch (style) {
    case "SUPPORTIVE":
      return `## Interview Style: Supportive
A conversational, low-pressure style.
- Rare interruptions. Let the candidate finish naturally.
- If they go off-topic, gently guide back: "That's helpful context. Let me bring us back to [topic]."
- Encourage with brief affirmations before moving on.`;
    case "PROFESSIONAL":
      return `## Interview Style: Professional
A structured, neutral style.
- Interrupt only when answers become unfocused or repetitive.
- "Let me stop you there — I'd like to hear specifically about [topic]."
- Keep a steady pace. One topic at a time.`;
    case "CHALLENGING":
      return `## Interview Style: Challenging
A high-pressure style. Push for depth.
- Interrupt aggressively when answers go off-track or stay surface-level.
- "Stop. Give me a concrete example." / "You're listing. Pick one and go deep."
- Demand specificity: "What does that mean quantitatively?"
- Challenge assumptions: "Why not a different approach?"`;
    case "BAR_RAISER":
      return `## Interview Style: Bar Raiser
An elite, surgical style.
- Sometimes allow a good answer, then challenge the next assumption.
- Do not challenge every statement. Choose the highest leverage point.
- Interrupt strategically — cut in only when the answer reveals a weak point.
- "I disagree with your premise. Why did you think that was the right approach?"
- "You keep saying 'we optimized it' — prove it. Before and after."
- Use deliberate silence after they finish. If they fill it, let them dig deeper.
- "What would you do differently?"`;
    default:
      return "";
  }
}
