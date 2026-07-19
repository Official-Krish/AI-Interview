export function buildQuantGenerationPrompt(params: {
  company: string;
  role: string;
  roleCategoryContext: string;
  depth: string;
  depthDirective: string;
  style: string;
  styleDirective: string;
}): string {
  return `Generate TWO distinct quantitative analysis interview questions for ${params.company} for the role of ${params.role}.${params.roleCategoryContext}

Depth: ${params.depth} — ${params.depthDirective}

Style: ${params.style} — ${params.styleDirective}

The two questions MUST be on different topics (e.g., not both market sizing). Suitable question types: market sizing, break-even analysis, pricing models, ROI analysis, statistical reasoning, expected value calculations.

Return ONLY valid JSON with this exact schema:
{
  "questions": [
    {
      "title": "A clear problem title",
      "description": "The full problem statement the candidate will see on their screen. Include all necessary context, data points, and the specific question they need to answer. 3-5 paragraphs.",
      "difficulty": "${params.depth}",
      "type": "market_sizing | break_even | pricing | roi | statistics | expected_value"
    },
    {
      "title": "A different problem title",
      "description": "Full problem statement for the second question",
      "difficulty": "${params.depth}",
      "type": "market_sizing | break_even | pricing | roi | statistics | expected_value"
    }
  ]
}

Example:
{
  "questions": [
    {
      "title": "Coffee Shop Market Sizing",
      "description": "Your client is a venture capital firm considering an investment in a premium coffee chain. They want to understand the total addressable market in New York City.\n\nEstimate:\n1. How many coffee shops are there in NYC?\n2. What is the total annual revenue of the NYC coffee shop market?\n3. What percentage is specialty/premium vs. mass market?\n4. What is the growth rate year-over-year?\n\nState all assumptions clearly. Show your calculations step by step.",
      "difficulty": "STANDARD",
      "type": "market_sizing"
    }
  ]
}`;
}
