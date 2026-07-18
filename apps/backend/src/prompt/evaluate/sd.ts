export const SYSTEM_DESIGN_EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Overall system design score 0-100",
    },
    dimensions: {
      type: "object",
      properties: {
        requirementsGathering: { type: "number", description: "0-100" },
        estimation: { type: "number", description: "0-100" },
        highLevelArchitecture: { type: "number", description: "0-100" },
        dataModel: { type: "number", description: "0-100" },
        scalability: { type: "number", description: "0-100" },
        faultTolerance: { type: "number", description: "0-100" },
        tradeoffsAndDepth: { type: "number", description: "0-100" },
      },
      required: [
        "requirementsGathering",
        "estimation",
        "highLevelArchitecture",
        "dataModel",
        "scalability",
        "faultTolerance",
        "tradeoffsAndDepth",
      ],
    },
    canvasFeedback: {
      type: "object",
      properties: {
        missingComponents: {
          type: "array",
          items: { type: "string" },
        },
        strongDecisions: {
          type: "array",
          items: { type: "string" },
        },
        weakDecisions: {
          type: "array",
          items: { type: "string" },
        },
        overallDiagramQuality: { type: "string" },
      },
      required: [
        "missingComponents",
        "strongDecisions",
        "weakDecisions",
        "overallDiagramQuality",
      ],
    },
    graphHistoryInsights: {
      type: "object",
      properties: {
        architectureEvolution: { type: "string" },
        patternStrengths: {
          type: "array",
          items: { type: "string" },
        },
        patternWeaknesses: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "architectureEvolution",
        "patternStrengths",
        "patternWeaknesses",
      ],
    },
    summary: { type: "string" },
    improvements: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "overallScore",
    "dimensions",
    "canvasFeedback",
    "graphHistoryInsights",
    "summary",
    "improvements",
  ],
} as const;
