export const FAILURE_SIGNALS = {
  NO_IMPACT_METRICS: {
    label: "Avoids discussing impact",
    description:
      "Describes work without business outcomes or measurable results",
  },
  WEAK_TRADEOFF_ANALYSIS: {
    label: "Weak tradeoff analysis",
    description: "Chooses approaches without evaluating alternatives",
  },
  INSUFFICIENT_REQUIREMENTS_CLARIFICATION: {
    label: "Doesn't clarify requirements",
    description: "Jumps to solutions without scoping the problem",
  },
  RAMBLING_STRUCTURE: {
    label: "Rambling without structure",
    description: "Answers lack clear narrative arc or framework",
  },
  SHALLOW_SYSTEM_DESIGN: {
    label: "Shallow system design",
    description: "Missing depth in architecture decisions",
  },
  WEAK_PRIORITIZATION: {
    label: "Weak prioritization",
    description: "Fails to identify what matters most under constraints",
  },
  WEAK_STAKEHOLDER_COMMUNICATION: {
    label: "Weak stakeholder communication",
    description: "Technical explanations not adapted to audience",
  },
  LACK_OF_OWNERSHIP: {
    label: "Lack of ownership",
    description: "Describes outcomes as someone else's responsibility",
  },
  POOR_DEBUGGING_PROCESS: {
    label: "Poor debugging process",
    description: "No systematic approach to diagnosing issues",
  },
  WEAK_EDGE_CASE_COVERAGE: {
    label: "Weak edge case coverage",
    description: "Misses error states, failure modes, or boundary conditions",
  },
  DEFENSIVE_RESPONSE_TO_FEEDBACK: {
    label: "Defensive when challenged",
    description: "Doesn't engage constructively with pushback",
  },
  INCOMPLETE_PROBLEM_DECOMPOSITION: {
    label: "Incomplete decomposition",
    description: "Doesn't break complex problems into manageable pieces",
  },
  OTHER: { label: "", description: "" },
} as const;

export type FailureSignalCode = keyof typeof FAILURE_SIGNALS;
