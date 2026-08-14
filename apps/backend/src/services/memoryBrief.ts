import { prisma } from "../lib/prisma";
import { retrieveMemories, type RetrievedMemory } from "./memory";
import type { MemoryType } from "@evalio/db";

interface BriefMemory {
  type: MemoryType;
  category: string;
  content: string;
  confidence: number;
  importance: number;
}

interface AggregatedPattern {
  code?: string;
  label?: string | null;
  severity?: string | null;
}

async function listAskedQuestions(
  userId: string,
  limitInterviews = 3,
  perInterview = 8,
): Promise<string[]> {
  const interviews = await prisma.interviewSession.findMany({
    where: { userId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: limitInterviews,
    select: { id: true },
  });

  const questions: string[] = [];
  const seen = new Set<string>();
  for (const iv of interviews) {
    const turns = await prisma.interviewTurn.findMany({
      where: { interviewId: iv.id },
      orderBy: { orderNumber: "asc" },
      take: perInterview,
      select: { questionText: true },
    });
    for (const t of turns) {
      const q = t.questionText.trim();
      if (!q || seen.has(q)) continue;
      seen.add(q);
      questions.push(q);
    }
  }
  return questions;
}

async function listTopMemories(
  userId: string,
  topic: string | null,
  k = 8,
): Promise<BriefMemory[]> {
  if (topic) {
    const rows = await retrieveMemories(userId, topic, k);
    return rows.map((m: RetrievedMemory) => ({
      type: m.type,
      category: m.category,
      content: m.content,
      confidence: m.confidence,
      importance: m.importance,
    }));
  }

  const rows = await prisma.$queryRaw<
    Array<{
      type: MemoryType;
      category: string;
      content: string;
      confidence: number;
      importance: number;
    }>
  >`
    SELECT type, category, content, confidence, importance
    FROM "Memory"
    WHERE "userId" = ${userId} AND status = 'ACTIVE'::"MemoryStatus"
    ORDER BY importance DESC, confidence DESC
    LIMIT ${k}
  `;
  return rows;
}

function parseFailurePatterns(raw: unknown): AggregatedPattern[] {
  if (Array.isArray(raw)) return raw as unknown as AggregatedPattern[];
  try {
    if (typeof raw === "string") return JSON.parse(raw) as AggregatedPattern[];
  } catch {
    /* ignore */
  }
  return [];
}

export async function buildMemoryBrief(
  userId: string,
  topic?: string | null,
): Promise<string | null> {
  const [memories, askedQuestions, profile] = await Promise.all([
    listTopMemories(userId, topic ?? null, 8),
    listAskedQuestions(userId),
    prisma.candidateSkillProfile.findUnique({
      where: { userId },
      select: { failurePatterns: true },
    }),
  ]);

  const failurePatternLabels = parseFailurePatterns(profile?.failurePatterns)
    .filter((p) => p.severity !== "low")
    .map((p) => p.label ?? p.code)
    .filter((x): x is string => Boolean(x));

  if (
    memories.length === 0 &&
    failurePatternLabels.length === 0 &&
    askedQuestions.length === 0
  ) {
    return null;
  }

  const strengths = memories.filter((m) => m.type === "SEMANTIC");
  const weaknesses = memories.filter(
    (m) => m.type === "FAILURE_PATTERN" || m.type === "EPISODIC",
  );

  const lines: string[] = ["CANDIDATE MEMORY"];

  if (strengths.length > 0) {
    lines.push("", "Known strengths:");
    for (const m of strengths) lines.push(`- ${m.content}`);
  }

  if (weaknesses.length > 0 || failurePatternLabels.length > 0) {
    lines.push("", "Known weaknesses / patterns:");
    for (const m of weaknesses) lines.push(`- ${m.content}`);
    for (const label of failurePatternLabels) lines.push(`- ${label}`);
  }

  if (askedQuestions.length > 0) {
    lines.push("", "Questions already asked in previous interviews:");
    for (const q of askedQuestions.slice(0, 10)) lines.push(`- "${q}"`);
  }

  return lines.join("\n");
}

export async function buildRuntimeGuidance(
  userId: string,
  topic?: string | null,
): Promise<string | null> {
  const [memories, askedQuestions] = await Promise.all([
    listTopMemories(userId, topic ?? null, 3),
    listAskedQuestions(userId, 3, 6),
  ]);

  const weaknesses = memories.filter(
    (m) => m.type === "FAILURE_PATTERN" || m.type === "EPISODIC",
  );
  if (weaknesses.length === 0 && askedQuestions.length === 0) return null;

  const lines: string[] = ["[INTERVIEWER CONTEXT]"];

  if (weaknesses.length > 0) {
    lines.push(
      "Candidate's known weak areas — probe gently if relevant to the current discussion, and acknowledge demonstrated improvement:",
    );
    for (const m of weaknesses) lines.push(`- ${m.content}`);
  }

  if (askedQuestions.length > 0) {
    lines.push("Do NOT repeat these previously asked questions:");
    for (const q of askedQuestions.slice(0, 6)) lines.push(`- ${q}`);
  }

  return lines.join("\n");
}
