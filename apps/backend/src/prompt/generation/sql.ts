const SQL_CACHED_QUESTIONS = 8;

export function buildSqlGenerationPrompt(params: {
  companyName: string;
  position: string;
  depth: string;
}): string {
  return `Generate exactly ${SQL_CACHED_QUESTIONS} SQL interview questions for ${params.companyName} for the role of ${params.position}. Depth: ${params.depth}.

Each question must include realistic table schemas and test practical SQL skills. Cover a variety of topics: JOINs, aggregations, subqueries, CTEs, window functions, and data modeling.

Return ONLY valid JSON — an array of ${SQL_CACHED_QUESTIONS} objects with this exact schema:
{
  "title": "Short question title",
  "schema": "Complete CREATE TABLE statements (2-4 related tables) with sensible column names and types",
  "description": "The problem statement in natural language — what query should they write and what should it return? Include specific requirements and edge cases to consider.",
  "difficulty": "EASY | MEDIUM | HARD",
  "solution": "The expected SQL solution query with comments explaining the approach"
}

Make questions progressively harder — start with EASY, build to HARD by the end. Each schema/domain should be different (e.g., e-commerce, HR, finance, logistics, healthcare, social media, education, music).`;
}
