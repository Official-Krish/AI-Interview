import { z } from "zod";
import type { MemoryStatus, MemoryType } from "@evalio/db";
import { prisma } from "@evalio/db";
import { embed, generateJson } from "@evalio/ai";

export interface MemoryCandidate {
  type: MemoryType;
  category: string;
  content: string;
  confidence: number;
  importance: number;
}

const MEMORY_CANDIDATE_SCHEMA = z.object({
  type: z.enum(["SEMANTIC", "EPISODIC", "FAILURE_PATTERN"]),
  category: z.string().min(1),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
});

const MEMORY_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    memories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["SEMANTIC", "EPISODIC", "FAILURE_PATTERN"],
          },
          category: { type: "string" },
          content: { type: "string" },
          confidence: { type: "number" },
          importance: { type: "number" },
        },
        required: ["type", "category", "content", "confidence", "importance"],
      },
    },
  },
  required: ["memories"],
} as const;

const MAX_MEMORIES_PER_INTERVIEW = 8;
const MAX_TRANSCRIPT_CHARS = 12_000;
const DEDUP_COSINE_THRESHOLD = 0.85;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function extractMemoriesFromInterview(
  interviewId: string,
): Promise<void> {
  if (!Bun.env.NVIDIA_API_KEY) return;

  const interview = await prisma.interviewSession.findUnique({
    where: { id: interviewId },
    include: {
      summary: true,
      turns: { orderBy: { orderNumber: "asc" } },
      user: { select: { name: true } },
    },
  });

  if (!interview || interview.turns.length === 0) return;

  const transcript = interview.turns
    .map(
      (t, i) =>
        `Q${i + 1}: ${t.questionText}\nA${i + 1}: ${t.answerText || "[no answer]"}`,
    )
    .join("\n\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);

  const summaryText = interview.summary
    ? `Overall score: ${interview.overallScore ?? "N/A"}
Strengths: ${JSON.stringify(interview.summary.strengths)}
Weaknesses: ${JSON.stringify(interview.summary.weaknesses)}
Improvement areas: ${JSON.stringify(interview.summary.improvementAreas)}`
    : "";

  const prompt = `Extract durable memories about the candidate from this interview transcript and summary.

A memory is a long-lived fact that stays useful in future interviews: skills and experience (SEMANTIC), notable performance in a specific situation (EPISODIC), or repeated weaknesses/patterns (FAILURE_PATTERN).

Do NOT store: one-off small talk, isolated answers, or anything unlikely to matter across interviews. Prefer a handful of high-value memories over many low-value ones. Return at most ${MAX_MEMORIES_PER_INTERVIEW}.

For each memory:
- type: SEMANTIC | EPISODIC | FAILURE_PATTERN
- category: a short topic label (e.g. "Redis", "System Design", "Communication", "Kubernetes")
- content: one concrete sentence about the candidate
- confidence: 0-1, how confident you are this is true
- importance: 0-1, how relevant this will be for future interviews

Candidate: ${interview.user.name ?? "Unknown"}
Position: ${interview.position ?? "N/A"}

${summaryText ? `SUMMARY:\n${summaryText}\n` : ""}
TRANSCRIPT:
${transcript}`;

  try {
    const parsed = await generateJson<{ memories: MemoryCandidate[] }>({
      prompt,
      jsonSchema: MEMORY_EXTRACTION_SCHEMA,
      schema: z.object({ memories: z.array(MEMORY_CANDIDATE_SCHEMA) }),
    });

    for (const candidate of parsed.memories
      .slice(0, MAX_MEMORIES_PER_INTERVIEW)
      .filter((m) => m.content.length > 0)) {
      await upsertMemory({
        userId: interview.userId,
        sourceInterviewId: interviewId,
        candidate,
      }).catch((err) => console.error("[memory] upsert failed:", err));
    }
  } catch (err) {
    console.error("[memory] extraction failed:", err);
  }
}

interface UpsertMemoryInput {
  userId: string;
  sourceInterviewId: string;
  candidate: MemoryCandidate;
}

export async function upsertMemory({
  userId,
  sourceInterviewId,
  candidate,
}: UpsertMemoryInput): Promise<void> {
  let vector: number[];
  try {
    vector = await embed(candidate.content);
  } catch (err) {
    console.error("[memory] embedding failed:", err);
    return;
  }
  const vecLiteral = toVectorLiteral(vector);

  const similar = await prisma.$queryRaw<
    Array<{ id: string; confidence: number; similarity: number }>
  >`
    SELECT id, confidence, 1 - (embedding <=> ${vecLiteral}::vector) AS similarity
    FROM "Memory"
    WHERE "userId" = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vecLiteral}::vector
    LIMIT 1
  `;

  const top = similar[0];
  if (top && top.similarity >= DEDUP_COSINE_THRESHOLD) {
    const mergedConfidence = clamp01(
      (top.confidence + candidate.confidence) / 2,
    );
    await prisma.$executeRaw`
      UPDATE "Memory"
      SET confidence = ${mergedConfidence},
          importance = ${candidate.importance},
          status = 'ACTIVE'::"MemoryStatus",
          "sourceInterviewId" = ${sourceInterviewId},
          embedding = ${vecLiteral}::vector,
          "updatedAt" = now(),
          "lastUsedAt" = now()
      WHERE id = ${top.id}
    `;
    return;
  }

  // No near-duplicate: create a new memory. The embedding column is
  // Unsupported by the Prisma client, so it is written via raw SQL.
  const memory = await prisma.memory.create({
    data: {
      userId,
      type: candidate.type,
      category: candidate.category,
      content: candidate.content,
      confidence: candidate.confidence,
      importance: candidate.importance,
      status: "ACTIVE",
      sourceInterviewId,
    },
  });

  await prisma.$executeRaw`
    UPDATE "Memory"
    SET embedding = ${vecLiteral}::vector
    WHERE id = ${memory.id}
  `;
}

export interface RetrievedMemory {
  id: string;
  type: MemoryType;
  category: string;
  content: string;
  confidence: number;
  importance: number;
  status: MemoryStatus;
  similarity: number;
}

export async function retrieveMemories(
  userId: string,
  query: string,
  k = 5,
): Promise<RetrievedMemory[]> {
  if (k <= 0) return [];

  let vector: number[];
  try {
    vector = await embed(query);
  } catch (err) {
    console.error("[memory] retrieve embed failed:", err);
    return [];
  }
  const vecLiteral = toVectorLiteral(vector);

  const rows = await prisma.$queryRaw<RetrievedMemory[]>`
    SELECT id, type, category, content, confidence, importance, status,
           1 - (embedding <=> ${vecLiteral}::vector) AS similarity
    FROM "Memory"
    WHERE "userId" = ${userId} AND embedding IS NOT NULL
    ORDER BY (1 - (embedding <=> ${vecLiteral}::vector)) * (0.5 + 0.5 * confidence) * (0.5 + 0.5 * importance) DESC
    LIMIT ${k}
  `;

  if (rows.length > 0) {
    await prisma.memory
      .updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});
  }

  return rows;
}

export async function applyEvidence(
  memoryId: string,
  strength: number,
): Promise<{
  id: string;
  confidence: number;
  status: MemoryStatus;
} | null> {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    select: { id: true, confidence: true },
  });
  if (!memory) return null;

  // strength in [-1, 1]: positive reinforces, negative weakens the memory.
  const delta =
    strength >= 0
      ? strength * (1 - memory.confidence)
      : strength * memory.confidence;
  const confidence = clamp01(memory.confidence + delta);
  const status: MemoryStatus =
    confidence < 0.3 ? "STALE" : strength < 0 ? "IMPROVING" : "ACTIVE";

  const updated = await prisma.memory.update({
    where: { id: memoryId },
    data: { confidence, status },
    select: { id: true, confidence: true, status: true },
  });

  return updated;
}
