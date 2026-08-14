import type { PrismaClient } from "@evalio/db";
import { NotFoundError, ValidationError, AppError } from "../lib/errors";
import { generateJson } from "../lib/ai";
import { buildQuantGenerationPrompt } from "../prompt/generation/quant";

export class QuantService {
  constructor(private prisma: PrismaClient) {}

  async startSession(userId: string, interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");
    if (interview.mode !== "LIVE_CODE")
      throw new ValidationError("Interview is not in LIVE_CODE mode");

    const existing = await this.prisma.dsaSession.findUnique({
      where: { interviewId },
      include: { problems: { orderBy: { index: "asc" } } },
    });
    if (existing) return { session: existing };

    const companyName = interview.companyName ?? null;
    const position = interview.position ?? null;
    const roleCategory =
      (interview as { roleCategory?: string | null }).roleCategory ?? null;
    const depth =
      (interview as { interviewDepth?: string }).interviewDepth || "STANDARD";
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

    const styleDirective =
      style === "SUPPORTIVE"
        ? "conversational and encouraging."
        : style === "CHALLENGING"
          ? "high-pressure, push for depth."
          : style === "BAR_RAISER"
            ? "surgical and precise."
            : "structured and neutral.";

    const generationPrompt = buildQuantGenerationPrompt({
      company,
      role,
      roleCategoryContext: roleCategory
        ? ` Tailar to the ${roleCategory} domain.`
        : "",
      depth,
      depthDirective,
      style,
      styleDirective,
    });

    let parsed: {
      questions: Array<{
        title: string;
        description: string;
        difficulty: string;
        type: string;
      }>;
    };
    try {
      parsed = await generateJson<{
        questions: Array<{
          title: string;
          description: string;
          difficulty: string;
          type: string;
        }>;
      }>({ prompt: generationPrompt });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[quant/start] generation failed:", message);
      throw new AppError("Failed to generate questions", 500);
    }

    const questions = parsed.questions;
    if (!questions || !Array.isArray(questions) || questions.length === 0)
      throw new AppError("Generated questions missing required fields", 500);

    for (const q of questions) {
      if (!q.title || !q.description || !q.difficulty)
        throw new AppError(
          "Generated question missing title, description, or difficulty",
          500,
        );
    }

    try {
      const session = await this.prisma.dsaSession.create({
        data: {
          interviewId,
          userId,
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
        include: { problems: { orderBy: { index: "asc" } } },
      });
      return { session };
    } catch (err) {
      console.error("[quant/start] session creation failed:", err);
      throw new AppError("Failed to create quant session", 500);
    }
  }
}
