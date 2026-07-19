export const CASE_STUDY_PROMPT = `You are generating a case study interview question for a consulting or business strategy interview. The question should test:
- Problem structuring and hypothesis-driven thinking
- Analytical reasoning and data interpretation
- Business judgment and strategic recommendations
- Communication and stakeholder management
- Ability to handle ambiguity and changing constraints`;

export const CASE_STUDY_QUESTION_SCHEMA_SINGLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, concise business case title",
    "description": "2-3 sentence overview of the business scenario and the core question to answer",
    "fullBreakdown": "Detailed markdown with: company context, market situation, key data points (revenue, costs, market size, growth rates), stakeholder perspectives, constraints, and the specific question the candidate must answer. Include enough detail for a thorough case analysis. Do NOT repeat or summarize the description."
  }
}`;

export const CASE_STUDY_QUESTION_SCHEMA_DOUBLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, concise business case title",
    "description": "2-3 sentence overview of the business scenario and the core question to answer",
    "fullBreakdown": "Detailed markdown with: company context, market situation, key data points, stakeholder perspectives, constraints, and the specific question the candidate must answer."
  },
  "backup": {
    "title": "A different business case title",
    "description": "2-3 sentence overview",
    "fullBreakdown": "Same structure as primary, different business scenario."
  }
}

The two questions MUST be on different business domains or scenarios.`;
