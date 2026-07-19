import { GoogleGenAI } from "@google/genai";
import type { PrismaClient } from "@evalio/db";
import { NotFoundError, ValidationError, AppError } from "../lib/errors";
import { buildSqlGenerationPrompt } from "../prompt/generation/sql";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SQL_CACHED_QUESTIONS = 8;

interface SqlQuestion {
  title: string;
  schema: string;
  description: string;
  difficulty: string;
  solution: string;
}

export class SqlService {
  constructor(private prisma: PrismaClient) {}

  async startSession(userId: string, interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");
    if (interview.mode !== "LIVE_CODE")
      throw new ValidationError("SQL session requires DSA mode interview");

    const existing = await this.prisma.dsaSession.findUnique({
      where: { interviewId },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    if (existing) return { session: existing };

    const companyName = interview.companyName ?? "a top tech company";
    const position = interview.position ?? "a data role";
    const depth = interview.interviewDepth ?? "PROBING";

    const generationPrompt = buildSqlGenerationPrompt({
      companyName,
      position,
      depth,
    });

    let questions: SqlQuestion[];
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: "application/json" },
      });
      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length !== SQL_CACHED_QUESTIONS)
        throw new Error(
          `Expected ${SQL_CACHED_QUESTIONS} questions, got ${parsed.length}`,
        );
      questions = parsed as SqlQuestion[];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[sql/start] generation failed:", message);
      throw new AppError("Failed to generate SQL questions", 500);
    }

    const session = await this.prisma.dsaSession.create({
      data: {
        interviewId,
        userId,
        language: "sql",
        problems: {
          create: questions.map((q, idx) => ({
            index: idx,
            title: q.title,
            slug: `sql-${idx}`,
            difficulty: q.difficulty,
            description: `## Schema\n\n\`\`\`sql\n${q.schema}\n\`\`\`\n\n## Question\n\n${q.description}`,
            code: q.solution,
            currentPhase: "understanding",
            phasesCompleted: [],
          })),
        },
      },
      include: { problems: { orderBy: { index: "asc" } } },
    });

    return { session };
  }
}
