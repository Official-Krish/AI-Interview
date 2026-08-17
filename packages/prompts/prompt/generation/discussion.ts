export const DISCUSSION_GENERATION_PROMPTS: Record<string, string> = {
  "Ice Breaker": `You are generating an ice breaker question. The question should establish rapport, be light and conversational, and help the candidate feel comfortable. Focus on topics like introductions, background summary, and initial impressions.`,

  "Technical Discussion": `You are generating a technical discussion question. The question should test deep technical knowledge relevant to the role. Focus on core concepts, architectural decisions, best practices, and problem-solving approaches.`,

  "Experience and Background": `You are generating an experience and background question. The question should explore the candidate's past work, projects, and contributions. Focus on specific examples, challenges faced, and outcomes achieved.`,

  "Behavioral and Soft Skills": `You are generating a behavioral and soft skills question. The question should assess interpersonal skills, communication, teamwork, leadership, and conflict resolution. Use the STAR format implicitly.`,

  "Motivation and Culture Fit": `You are generating a motivation and culture fit question. The question should explore why the candidate wants this role, what drives them, and how they align with company values and culture.`,

  "Role Play (FE)": `You are generating a frontend role-play scenario. The candidate must act as a senior frontend engineer handling a realistic workplace situation involving code review, technical disagreement, stakeholder negotiation, or cross-team collaboration.`,

  "Role Play (BE)": `You are generating a backend role-play scenario. The candidate must act as a senior backend engineer handling a realistic workplace situation involving system design tradeoffs, incident response, technical debt prioritization, or cross-team coordination.`,

  "Role Play (Full-Stack)": `You are generating a full-stack role-play scenario. The candidate must act as a senior full-stack engineer handling end-to-end feature ownership, balancing frontend and backend concerns, API design negotiations, or full-stack incident resolution.`,

  "Role Play (PM)": `You are generating a product management role-play scenario. The candidate must act as a PM handling stakeholder alignment, feature prioritization, roadmap tradeoffs, or cross-functional team dynamics.`,

  "Role Play (Design)": `You are generating a design role-play scenario. The candidate must act as a designer handling feedback sessions, design system contributions, stakeholder presentations, or cross-functional design critiques.`,

  "Role Play (DevOps)": `You are generating a DevOps role-play scenario. The candidate must act as a DevOps engineer handling infrastructure incidents, capacity planning, deployment strategy debates, or security compliance discussions.`,

  "Career Development": `You are generating a career development question. The question should explore the candidate's career aspirations, growth areas, learning journey, and long-term professional goals.`,

  "Wrap Up": `You are generating a wrap-up question. Give the candidate a chance to ask questions, share final thoughts, or reflect on the interview experience. Keep it positive and forward-looking.`,
};

export const DISCUSSION_QUESTION_SCHEMA_SINGLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, concise question title",
    "description": "2-3 sentence overview of what the question is about",
    "fullBreakdown": "Detailed markdown with: context and background, the specific question to answer, what a good answer includes, common pitfalls to avoid, follow-up areas to explore. Do NOT repeat or summarize the description."
  }
}`;

export const DISCUSSION_QUESTION_SCHEMA_DOUBLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, concise question title",
    "description": "2-3 sentence overview",
    "fullBreakdown": "Detailed markdown with: context, question, what a good answer includes, common pitfalls, follow-up areas."
  },
  "backup": {
    "title": "A different question title",
    "description": "2-3 sentence overview",
    "fullBreakdown": "Same structure as primary, different topic."
  }
}

The two questions MUST be on different topics.`;
