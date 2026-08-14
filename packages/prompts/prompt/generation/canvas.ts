export const ROUND_GENERATION_PROMPTS: Record<string, string> = {
  "Product Sense": `You are generating a product sense interview question. The question should test:
- User empathy and problem identification
- Goal setting and success metrics
- Solution exploration and prioritization
- Tradeoff analysis`,

  "Design Critique": `You are generating a design critique interview question. The question should test:
- First impressions and gut reaction to design
- Usability heuristics and user flows
- Visual design and interaction patterns
- Accessibility and inclusive design
- Prioritization of feedback`,

  "Strategy & Vision": `You are generating a strategy & vision interview question. The question should test:
- Current state assessment and constraint identification
- Vision setting and roadmap planning
- Org design and execution strategy
- Risk management and stakeholder communication`,
};

export const CANVAS_QUESTION_SCHEMA_SINGLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, specific scenario title",
    "description": "2-3 sentence description of the challenge",
    "fullBreakdown": "Detailed markdown with context, user needs, success metrics, constraints, key questions to explore. Do NOT repeat or summarize the description."
  }
}`;

export const CANVAS_QUESTION_SCHEMA_DOUBLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, specific scenario title",
    "description": "2-3 sentence description of the challenge",
    "fullBreakdown": "Detailed markdown with context, user needs, success metrics, constraints, key questions to explore. Do NOT repeat or summarize the description."
  },
  "backup": {
    "title": "A different scenario",
    "description": "2-3 sentence description",
    "fullBreakdown": "Same structure as primary, different topic."
  }
}

The two questions MUST be on different topics.`;
