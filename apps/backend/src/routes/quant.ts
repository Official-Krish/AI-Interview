import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const quantRoutes = new Elysia({ prefix: "/quant" })
  .use(authGuard)
  .guard({}, (app) =>
    app.post(
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
          return { error: "Interview is not in LIVE_CODE mode" };
        }

        // Check if session already exists
        const existing = await prisma.dsaSession.findUnique({
          where: { interviewId },
          include: { problems: { orderBy: { index: "asc" } } },
        });
        if (existing) return { session: existing };

        const companyName = interview.companyName ?? null;
        const position = interview.position ?? null;
        const roleCategory =
          (interview as { roleCategory?: string | null }).roleCategory ?? null;
        const depth =
          (interview as { interviewDepth?: string }).interviewDepth ||
          "STANDARD";
        const style =
          (interview as { interviewStyle?: string }).interviewStyle ||
          "PROFESSIONAL";

        const company = companyName || "a top firm";
        const role = position || "a quantitative role";

        const depthDirective =
          depth === "STANDARD"
            ? "Pick a moderately complex quantitative problem."
            : depth === "PROBING"
              ? "Pick a nuanced multi-variable problem."
              : depth === "CHALLENGE"
                ? "Pick a complex problem requiring advanced modeling."
                : "Pick an elite-level problem with uncertainty and sensitivity analysis.";

        const generationPrompt = `Generate TWO distinct quantitative analysis interview questions for ${company} for the role of ${role}.${roleCategory ? ` Tailor to the ${roleCategory} domain.` : ""}

Depth: ${depth} — ${depthDirective}

Style: ${style} — ${
          style === "SUPPORTIVE"
            ? "conversational and encouraging."
            : style === "CHALLENGING"
              ? "high-pressure, push for depth."
              : style === "BAR_RAISER"
                ? "surgical and precise."
                : "structured and neutral."
        }

The two questions MUST be on different topics (e.g., not both market sizing). Suitable question types: market sizing, break-even analysis, pricing models, ROI analysis, statistical reasoning, expected value calculations.

Return ONLY valid JSON with this exact schema:
{
  "questions": [
    {
      "title": "A clear problem title",
      "description": "The full problem statement the candidate will see on their screen. Include all necessary context, data points, and the specific question they need to answer. 3-5 paragraphs.",
      "difficulty": "${depth}",
      "type": "market_sizing | break_even | pricing | roi | statistics | expected_value"
    },
    {
      "title": "A different problem title",
      "description": "Full problem statement for the second question",
      "difficulty": "${depth}",
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
}
`;

        let parsed: {
          questions: Array<{
            title: string;
            description: string;
            difficulty: string;
            type: string;
          }>;
        };
        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
            config: { responseMimeType: "application/json" },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from Gemini");
          parsed = JSON.parse(text);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[quant/start] generation failed:", message);
          set.status = 500;
          return { error: "Failed to generate questions" };
        }

        const questions = parsed.questions;
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
          set.status = 500;
          return { error: "Generated questions missing required fields" };
        }

        // Validate each question has required fields
        for (const q of questions) {
          if (!q.title || !q.description || !q.difficulty) {
            set.status = 500;
            return {
              error:
                "Generated question missing title, description, or difficulty",
            };
          }
        }

        // Create DsaSession and problems inline (following dsa.ts / sql.ts pattern)
        try {
          const session = await prisma.dsaSession.create({
            data: {
              interviewId,
              userId: user.id,
              language: "text",
              problems: {
                create: questions.map((q, i) => ({
                  index: i,
                  title: q.title,
                  slug: q.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                  difficulty: q.difficulty,
                  description: q.description,
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
        } catch (err) {
          console.error("[quant/start] session creation failed:", err);
          set.status = 500;
          return { error: "Failed to create quant session" };
        }
      },
      {
        body: t.Object({
          interviewId: t.String(),
        }),
      },
    ),
  );
