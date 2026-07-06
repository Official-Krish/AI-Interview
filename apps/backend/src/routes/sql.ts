import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

interface SqlQuestion {
  title: string;
  schema: string;
  description: string;
  difficulty: string;
  solution: string;
}

const SQL_CACHED_QUESTIONS = 8;

export const sqlRoutes = new Elysia({ prefix: "/sql" })
  .use(authGuard)
  .guard({}, (app) =>
    app
      .post(
        "/start",
        async ({ user, body, set }) => {
          const { interviewId } = body;

          const interview = await prisma.interviewSession.findUnique({
            where: { id: interviewId },
          });
          if (!interview || interview.userId !== user.id) {
            set.status = 404;
            return { error: "Interview not found" };
          }
          if (interview.mode !== "LIVE_CODE") {
            set.status = 400;
            return { error: "SQL session requires DSA mode interview" };
          }

          const existing = await prisma.dsaSession.findUnique({
            where: { interviewId },
            include: {
              problems: { orderBy: { index: "asc" } },
            },
          });
          if (existing) return { session: existing };

          // Generate 8 SQL questions via Gemini
          const companyName = interview.companyName ?? "a top tech company";
          const position = interview.position ?? "a data role";
          const depth = interview.interviewDepth ?? "PROBING";

          const generationPrompt = `Generate exactly ${SQL_CACHED_QUESTIONS} SQL interview questions for ${companyName} for the role of ${position}. Depth: ${depth}.

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
            if (
              !Array.isArray(parsed) ||
              parsed.length !== SQL_CACHED_QUESTIONS
            ) {
              throw new Error(
                `Expected ${SQL_CACHED_QUESTIONS} questions, got ${parsed.length}`,
              );
            }
            questions = parsed as SqlQuestion[];
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("[sql/start] generation failed:", message);
            set.status = 500;
            return { error: "Failed to generate SQL questions" };
          }

          // Create DsaSession with 8 problems
          const session = await prisma.dsaSession.create({
            data: {
              interviewId,
              userId: user.id,
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
            include: {
              problems: { orderBy: { index: "asc" } },
            },
          });

          return { session };
        },
        {
          body: t.Object({
            interviewId: t.String(),
          }),
        },
      )
      .get("/session/:id", async ({ params: { id }, user, set }) => {
        const session = await prisma.dsaSession.findUnique({
          where: { id },
          include: {
            problems: { orderBy: { index: "asc" } },
          },
        });
        if (!session || session.userId !== user.id) {
          set.status = 404;
          return { error: "Session not found" };
        }
        return { session };
      }),
  );
