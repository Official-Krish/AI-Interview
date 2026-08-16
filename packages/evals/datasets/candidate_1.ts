import type { MemoryType } from "@evalio/db";
import {
  createUser,
  cleanupUser,
  createMemory,
  createCompletedInterview,
} from "./helpers";

export const CANDIDATE_1_EMAIL = "eval-candidate-1@test.dev";

export interface CandidateMemory {
  type: MemoryType;
  category: string;
  content: string;
  confidence: number;
  importance: number;
}

export const CANDIDATE_1_MEMORIES: CandidateMemory[] = [
  {
    type: "SEMANTIC",
    category: "Redis",
    content:
      "Candidate has strong experience using Redis for caching in production.",
    confidence: 0.85,
    importance: 0.7,
  },
  {
    type: "FAILURE_PATTERN",
    category: "Kubernetes",
    content:
      "Candidate struggles with Kubernetes networking and debugging ingress 502 errors.",
    confidence: 0.9,
    importance: 0.95,
  },
  {
    type: "SEMANTIC",
    category: "TypeScript",
    content: "Candidate is proficient with TypeScript.",
    confidence: 0.8,
    importance: 0.5,
  },
  {
    type: "SEMANTIC",
    category: "PostgreSQL",
    content: "Candidate has hands-on experience with PostgreSQL.",
    confidence: 0.8,
    importance: 0.5,
  },
];

export async function seedCandidate1(opts?: {
  questions?: string[];
  strongKubernetes?: boolean;
}) {
  const user = await createUser(CANDIDATE_1_EMAIL);
  const interview = await createCompletedInterview(
    user.id,
    opts?.questions ?? [],
  );
  for (const m of CANDIDATE_1_MEMORIES) {
    await createMemory({
      userId: user.id,
      sourceInterviewId: interview.id,
      type: m.type,
      category: m.category,
      content: m.content,
      confidence: m.confidence,
      importance: m.importance,
    });
  }
  if (opts?.strongKubernetes) {
    await createMemory({
      userId: user.id,
      sourceInterviewId: interview.id,
      type: "SEMANTIC",
      category: "Kubernetes",
      content:
        "Candidate has strong Kubernetes fundamentals and understands core concepts like pods, deployments and services.",
      confidence: 0.85,
      importance: 0.7,
    });
  }
  return user;
}

export async function cleanupCandidate1() {
  await cleanupUser(CANDIDATE_1_EMAIL);
}
