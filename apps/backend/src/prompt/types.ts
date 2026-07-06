export interface CandidateHistoryEntry {
  date: string;
  role: string | null;
  overallScore: number | null;
  strengths: string[];
  weaknesses: string[];
  summary: string | null;
  mode?: string;
}

export interface PromptInput {
  position: string | null;
  candidateName: string | null;
  resumeText: string | null;
  jobDescription: string | null;
  githubUsername: string | null;
  githubSummary: string | null;
  githubLanguages: string[];
  githubProjects: {
    name: string;
    description: string | null;
    stars: number;
    language: string | null;
  }[];
  durationMinutes: number;
  interviewStyle: "SUPPORTIVE" | "PROFESSIONAL" | "CHALLENGING" | "BAR_RAISER";
  interviewDepth: "STANDARD" | "PROBING" | "CHALLENGE" | "BAR_RAISER";
  companyName: string | null;
  companyCulture: string[] | null;
  companyInterviewerBehavior: string[] | null;
  companyEvaluationBiases: string[] | null;
  roleTopics: string[] | null;
  roleEvaluationCriteria: string[] | null;
  roleMustProbe: string[] | null;
  interviewRound: string | null;
  candidateHistory: CandidateHistoryEntry[];
  overallMostImproved: string | null;
  overallWeakest: string | null;
  overallPatterns: string[];
  scoreTrendLast5: "improving" | "stable" | "declining" | null;
  roleCategory?: string | null;
  seniorityLabel?: string | null;
}

export interface SystemDesignPromptInput {
  position: string | null;
  candidateName: string | null;
  companyName: string | null;
  companyCulture: string[] | null;
  companyInterviewerBehavior: string[] | null;
  companyEvaluationBiases: string[] | null;
  roleTopics: string[] | null;
  roleEvaluationCriteria: string[] | null;
  roleMustProbe: string[] | null;
  interviewRound: string | null;
  resumeText: string | null;
  jobDescription: string | null;
  githubUsername: string | null;
  githubSummary: string | null;
  githubLanguages: string[];
  githubProjects: {
    name: string;
    description: string | null;
    stars: number;
    language: string | null;
  }[];
  interviewStyle: "SUPPORTIVE" | "PROFESSIONAL" | "CHALLENGING" | "BAR_RAISER";
  interviewDepth: "STANDARD" | "PROBING" | "CHALLENGE" | "BAR_RAISER";
  durationMinutes: number;
  candidateHistory: CandidateHistoryEntry[];
  overallMostImproved: string | null;
  overallWeakest: string | null;
  overallPatterns: string[];
  scoreTrendLast5: "improving" | "stable" | "declining" | null;
  roleCategory?: string | null;
  seniorityLabel?: string | null;
}

export interface PacingBudget {
  name: string;
  budgetPct: number;
}
