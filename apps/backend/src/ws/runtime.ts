export interface SimplifiedQuestion {
  turn: number;
  reason: "struggling" | "time" | "misunderstood";
  originalDifficulty?: string;
}

export interface FollowUpItem {
  topic: string;
  context: string;
  asked: boolean;
}

export interface InterviewerNote {
  turn: number;
  note: string;
  severity: "praise" | "minor" | "major";
  category: "problem_solving" | "communication" | "technical" | "leadership";
  timestamp: number;
}

export type ReactionType = "nod" | "thinking" | "impressed" | "skeptical";

export interface Constraint {
  constraint: "memory" | "bandwidth" | "latency" | "storage" | "users";
  value: string;
  revertAfterMs?: number;
  appliedAt: number;
}

export interface RecoveryEvent {
  turn: number;
  type: "confidence_increase" | "signal_improvement" | "direction_change";
  description: string;
}

export interface InterviewerRuntime {
  pressureLevel: "normal" | "elevated" | "high";
  coachingMode: boolean;
  pace: "normal" | "fast";
  silenceMode: "normal" | "extended";
  followUps: FollowUpItem[];
  notes: InterviewerNote[];
  simplifiedQuestions: SimplifiedQuestion[];
  constraints: Constraint[];
  overconfidenceDetected: boolean;
  highConfidenceStreak: number;
  challengeCount: number;
  recoveryEvents: RecoveryEvent[];
  lastReaction: ReactionType | null;
  reactionLastSentAt: number;
}

export function createDefaultRuntime(): InterviewerRuntime {
  return {
    pressureLevel: "normal",
    coachingMode: false,
    pace: "normal",
    silenceMode: "normal",
    followUps: [],
    notes: [],
    simplifiedQuestions: [],
    constraints: [],
    overconfidenceDetected: false,
    highConfidenceStreak: 0,
    challengeCount: 0,
    recoveryEvents: [],
    lastReaction: null,
    reactionLastSentAt: 0,
  };
}
