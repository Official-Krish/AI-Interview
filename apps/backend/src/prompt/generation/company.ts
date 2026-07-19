export function buildCompanyGenerationPrompt(params: {
  companyName: string;
  industry: string;
}): string {
  return `You are a company interview context generator.

Generate a JSON object for the company "${params.companyName}" (${params.industry}) with the following fields:
- "personality": A 2-3 sentence description of what it's like to interview at this company, what they value, their culture, and how they conduct interviews.
- "roles": An array of 3 role objects, each with:
  - "title": A realistic job title at this company
  - "description": A 1-sentence description of what the role does
  - "defaultStyle": one of "SUPPORTIVE", "PROFESSIONAL", "CHALLENGING", "BAR_RAISER"
  - "defaultDepth": one of "STANDARD", "PROBING", "CHALLENGE", "BAR_RAISER"

Return ONLY valid JSON, no markdown formatting or code fences.`;
}
