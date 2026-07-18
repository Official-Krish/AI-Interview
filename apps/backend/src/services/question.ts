import { GoogleGenAI } from "@google/genai";
import type { PrismaClient } from "@evalio/db";
import {
  getCachedQuestion,
  setCachedQuestion,
  clearCachedQuestion,
} from "../lib/questionCache";
import { AppError, NotFoundError, ValidationError } from "../lib/errors";
import {
  ROUND_GENERATION_PROMPTS,
  CANVAS_QUESTION_SCHEMA_SINGLE,
  CANVAS_QUESTION_SCHEMA_DOUBLE,
  DISCUSSION_GENERATION_PROMPTS,
  DISCUSSION_QUESTION_SCHEMA_SINGLE,
  DISCUSSION_QUESTION_SCHEMA_DOUBLE,
  CASE_STUDY_PROMPT,
  CASE_STUDY_QUESTION_SCHEMA_SINGLE,
  CASE_STUDY_QUESTION_SCHEMA_DOUBLE,
} from "../prompt/generation";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type GenResult = {
  primary: { title: string; description: string; fullBreakdown: string };
  backup?: { title: string; description: string; fullBreakdown: string };
};

interface CacheEntry {
  title: string;
  description: string;
  fullBreakdown: string;
  backupTitle: string;
  backupDescription: string;
  backupFullBreakdown: string;
  difficulty: string;
  questionCount: number;
}

function buildCacheKey(
  roundLabel: string,
  depth: string,
  style: string,
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
): string {
  return `${roundLabel}::${depth}::${style}::${roleCategory ?? "__none__"}::${companyName ?? "__none__"}::${position ?? "__none__"}`;
}

// ── Canvas ─────────────────────────────────────────────────────────

async function generateCanvasQuestions(
  roundLabel: string,
  company: string,
  role: string,
  depth: string,
  style: string,
  roleCategory: string | null,
  questionCount: number,
): Promise<GenResult> {
  const categoryContext = roleCategory
    ? `\nTailor the question to the ${roleCategory} domain — the role is at ${company} for ${role}.`
    : `\nThe role is at ${company} for ${role}.`;

  const depthDirective =
    depth === "STANDARD"
      ? "Pick a moderately complex scenario. Focus on core thinking."
      : depth === "PROBING"
        ? "Pick a nuanced scenario with multiple stakeholders or constraints."
        : depth === "CHALLENGE"
          ? "Pick a complex scenario with organizational or market complexity."
          : "Pick an elite-level scenario. Multi-dimensional, ambiguous, high-stakes.";

  const countDirective =
    questionCount === 1
      ? "Generate ONE question."
      : "Generate TWO distinct questions on different topics.";

  const schema =
    questionCount === 1
      ? CANVAS_QUESTION_SCHEMA_SINGLE
      : CANVAS_QUESTION_SCHEMA_DOUBLE;

  const generationPrompt = `${countDirective}${categoryContext}

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

${schema}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
    config: { responseMimeType: "application/json" },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

export function clearCanvasQuestion(interviewId: string) {
  clearCachedQuestion("canvas", interviewId);
}

export function getCanvasQuestion(
  interviewId: string,
  _roundLabel?: string,
  _depth?: string,
  _style?: string,
  _roleCategory?: string | null,
  _companyName?: string | null,
  _position?: string | null,
) {
  return getCachedQuestion<CacheEntry>("canvas", interviewId);
}

// ── Discussion ─────────────────────────────────────────────────────

async function generateDiscussionQuestions(
  roundLabel: string,
  company: string,
  role: string,
  depth: string,
  style: string,
  roleCategory: string | null,
  questionCount: number,
): Promise<GenResult> {
  const basePrompt = DISCUSSION_GENERATION_PROMPTS[roundLabel];
  const categoryContext = roleCategory
    ? `\nTailor the scenario to the ${roleCategory} domain — the role is at ${company} for ${role}.`
    : `\nThe role is at ${company} for ${role}.`;

  const depthDirective =
    depth === "STANDARD"
      ? "Pick a moderately complex scenario. Focus on core reasoning."
      : depth === "PROBING"
        ? "Pick a nuanced scenario with multiple dimensions."
        : depth === "CHALLENGE"
          ? "Pick a complex scenario with competing priorities and ambiguity."
          : "Pick an elite-level scenario with multi-dimensional tradeoffs and high stakes.";

  const countDirective =
    questionCount === 1
      ? "Generate ONE question."
      : "Generate TWO distinct questions on different topics.";

  const schema =
    questionCount === 1
      ? DISCUSSION_QUESTION_SCHEMA_SINGLE
      : DISCUSSION_QUESTION_SCHEMA_DOUBLE;

  const generationPrompt = `${countDirective}${categoryContext}

Depth: ${depth} — ${depthDirective}

Style: ${style} — ${
    style === "SUPPORTIVE"
      ? "encouraging and guiding."
      : style === "CHALLENGING"
        ? "high-pressure, push for depth."
        : style === "BAR_RAISER"
          ? "surgical and precise."
          : "structured and neutral."
  }

${basePrompt}

${schema}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
    config: { responseMimeType: "application/json" },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

export function clearDiscussionQuestion(interviewId: string) {
  clearCachedQuestion("discussion", interviewId);
}

export function getDiscussionQuestion(
  interviewId: string,
  _roundLabel?: string,
  _depth?: string,
  _style?: string,
  _roleCategory?: string | null,
  _companyName?: string | null,
  _position?: string | null,
) {
  return getCachedQuestion<CacheEntry>("discussion", interviewId);
}

// ── Case Study ─────────────────────────────────────────────────────

async function generateCaseStudyQuestions(
  company: string,
  role: string,
  depth: string,
  style: string,
  roleCategory: string | null,
  questionCount: number,
): Promise<GenResult> {
  const categoryContext = roleCategory
    ? `\nTailor the case to the ${roleCategory} domain — the role is at ${company} for ${role}.`
    : `\nThe role is at ${company} for ${role}.`;

  const depthDirective =
    depth === "STANDARD"
      ? "Pick a moderately complex business scenario. Focus on core analytical reasoning."
      : depth === "PROBING"
        ? "Pick a nuanced scenario with multiple stakeholder perspectives and ambiguous data."
        : depth === "CHALLENGE"
          ? "Pick a complex scenario with competing priorities, market shifts, and incomplete information."
          : "Pick an elite-level scenario with multi-dimensional strategic tradeoffs and high stakes.";

  const countDirective =
    questionCount === 1
      ? "Generate ONE case study question."
      : "Generate TWO distinct case study questions on different business domains.";

  const schema =
    questionCount === 1
      ? CASE_STUDY_QUESTION_SCHEMA_SINGLE
      : CASE_STUDY_QUESTION_SCHEMA_DOUBLE;

  const generationPrompt = `${countDirective}${categoryContext}

Depth: ${depth} — ${depthDirective}

Style: ${style} — ${
    style === "SUPPORTIVE"
      ? "focused on guiding the candidate through structured thinking."
      : style === "CHALLENGING"
        ? "high-pressure, push for quantitative rigor and defensible recommendations."
        : style === "BAR_RAISER"
          ? "surgical precision — demand partner-level synthesis and tradeoff articulation."
          : "structured and neutral — balanced analytical depth."
  }

${CASE_STUDY_PROMPT}

${schema}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
    config: { responseMimeType: "application/json" },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

export function clearCaseStudyQuestion(interviewId: string) {
  clearCachedQuestion("casestudy", interviewId);
}

// ── Service ────────────────────────────────────────────────────────

interface StartQuestionResult {
  title: string;
  description: string;
  fullBreakdown: string;
  difficulty: string;
  questionCount: number;
  questions: { title: string; description: string; fullBreakdown: string }[];
}

export class QuestionService {
  constructor(private prisma: PrismaClient) {}

  async startCanvasQuestion(
    userId: string,
    interviewId: string,
  ): Promise<StartQuestionResult> {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");
    if (interview.mode !== "LIVE_CANVAS")
      throw new ValidationError("Interview is not in LIVE_CANVAS mode");

    const roundLabel = (interview as { interviewRound?: string | null })
      .interviewRound;
    if (!roundLabel || !ROUND_GENERATION_PROMPTS[roundLabel])
      throw new ValidationError(`Unsupported canvas round: ${roundLabel}`);

    const companyName = interview.companyName ?? null;
    const position = interview.position ?? null;
    const roleCategory =
      (interview as { roleCategory?: string | null }).roleCategory ?? null;
    const depth =
      (interview as { interviewDepth?: string }).interviewDepth || "PROBING";
    const style =
      (interview as { interviewStyle?: string }).interviewStyle ||
      "PROFESSIONAL";

    const existing = await getCachedQuestion<CacheEntry>("canvas", interviewId);
    if (existing) return formatCacheEntry(existing);

    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const userRole = userRecord?.role ?? "FREE";
    const isEngineering = roleCategory === "engineering";
    const isProOrAdmin = userRole === "ADMIN" || userRole === "PRO";
    const questionCount = isEngineering || isProOrAdmin ? 2 : 1;

    const company = companyName || "a top tech company";
    const role = position || "a senior role";

    let parsed: GenResult;
    try {
      parsed = await generateCanvasQuestions(
        roundLabel,
        company,
        role,
        depth,
        style,
        roleCategory,
        questionCount,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[canvas/start] generation failed for ${roundLabel}:`,
        message,
      );
      throw new AppError("Failed to generate question", 500);
    }

    validateGenResult(parsed, questionCount);

    const entry: CacheEntry = {
      title: parsed.primary.title,
      description: parsed.primary.description,
      fullBreakdown: parsed.primary.fullBreakdown,
      backupTitle: parsed.backup?.title ?? "",
      backupDescription: parsed.backup?.description ?? "",
      backupFullBreakdown: parsed.backup?.fullBreakdown ?? "",
      difficulty: depth,
      questionCount,
    };

    await setCachedQuestion(
      "canvas",
      interviewId,
      buildCacheKey(
        roundLabel,
        depth,
        style,
        roleCategory,
        companyName,
        position,
      ),
      entry,
    );

    return formatCacheEntry(entry);
  }

  async startDiscussionQuestion(
    userId: string,
    interviewId: string,
  ): Promise<StartQuestionResult> {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");
    if (interview.mode !== "DISCUSSION")
      throw new ValidationError("Interview is not in DISCUSSION mode");

    const roundLabel = (interview as { interviewRound?: string | null })
      .interviewRound;
    if (!roundLabel || !DISCUSSION_GENERATION_PROMPTS[roundLabel])
      throw new ValidationError(`Unsupported discussion round: ${roundLabel}`);

    const companyName = interview.companyName ?? null;
    const position = interview.position ?? null;
    const roleCategory =
      (interview as { roleCategory?: string | null }).roleCategory ?? null;
    const depth =
      (interview as { interviewDepth?: string }).interviewDepth || "PROBING";
    const style =
      (interview as { interviewStyle?: string }).interviewStyle ||
      "PROFESSIONAL";

    const existing = await getCachedQuestion<CacheEntry>(
      "discussion",
      interviewId,
    );
    if (existing) return formatCacheEntry(existing);

    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const userRole = userRecord?.role ?? "FREE";
    const isProOrAdmin = userRole === "ADMIN" || userRole === "PRO";
    const questionCount = isProOrAdmin ? 2 : 1;

    const company = companyName || "a top company";
    const role = position || "a senior role";

    let parsed: GenResult;
    try {
      parsed = await generateDiscussionQuestions(
        roundLabel,
        company,
        role,
        depth,
        style,
        roleCategory,
        questionCount,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[discussion/start] generation failed for ${roundLabel}:`,
        message,
      );
      throw new AppError("Failed to generate question", 500);
    }

    validateGenResult(parsed, questionCount);

    const entry: CacheEntry = {
      title: parsed.primary.title,
      description: parsed.primary.description,
      fullBreakdown: parsed.primary.fullBreakdown,
      backupTitle: parsed.backup?.title ?? "",
      backupDescription: parsed.backup?.description ?? "",
      backupFullBreakdown: parsed.backup?.fullBreakdown ?? "",
      difficulty: depth,
      questionCount,
    };

    await setCachedQuestion(
      "discussion",
      interviewId,
      buildCacheKey(
        roundLabel,
        depth,
        style,
        roleCategory,
        companyName,
        position,
      ),
      entry,
    );

    return formatCacheEntry(entry);
  }

  async startCaseStudyQuestion(
    userId: string,
    interviewId: string,
  ): Promise<StartQuestionResult> {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");
    if (interview.mode !== "DISCUSSION")
      throw new ValidationError("Interview is not in DISCUSSION mode");

    const roundLabel = (interview as { interviewRound?: string | null })
      .interviewRound;
    if (roundLabel !== "Case Study")
      throw new ValidationError(`Unsupported round: ${roundLabel}`);

    const companyName = interview.companyName ?? null;
    const position = interview.position ?? null;
    const roleCategory =
      (interview as { roleCategory?: string | null }).roleCategory ?? null;
    const depth =
      (interview as { interviewDepth?: string }).interviewDepth || "PROBING";
    const style =
      (interview as { interviewStyle?: string }).interviewStyle ||
      "PROFESSIONAL";

    const existing = await getCachedQuestion<CacheEntry>(
      "casestudy",
      interviewId,
    );
    if (existing) return formatCacheEntry(existing);

    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const userRole = userRecord?.role ?? "FREE";
    const isEngineering = roleCategory === "engineering";
    const isProOrAdmin = userRole === "ADMIN" || userRole === "PRO";
    const questionCount = isEngineering || isProOrAdmin ? 2 : 1;

    const company = companyName || "a top company";
    const role = position || "a senior role";

    let parsed: GenResult;
    try {
      parsed = await generateCaseStudyQuestions(
        company,
        role,
        depth,
        style,
        roleCategory,
        questionCount,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[case-study/start] generation failed:", message);
      throw new AppError("Failed to generate case study question", 500);
    }

    validateGenResult(parsed, questionCount);

    const entry: CacheEntry = {
      title: parsed.primary.title,
      description: parsed.primary.description,
      fullBreakdown: parsed.primary.fullBreakdown,
      backupTitle: parsed.backup?.title ?? "",
      backupDescription: parsed.backup?.description ?? "",
      backupFullBreakdown: parsed.backup?.fullBreakdown ?? "",
      difficulty: depth,
      questionCount,
    };

    await setCachedQuestion(
      "casestudy",
      interviewId,
      buildCacheKey(
        roundLabel,
        depth,
        style,
        roleCategory,
        companyName,
        position,
      ),
      entry,
    );

    return formatCacheEntry(entry);
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function formatCacheEntry(entry: CacheEntry): StartQuestionResult {
  const questions = [
    {
      title: entry.title,
      description: entry.description,
      fullBreakdown: entry.fullBreakdown,
    },
  ];
  if (entry.questionCount > 1 && entry.backupTitle) {
    questions.push({
      title: entry.backupTitle,
      description: entry.backupDescription,
      fullBreakdown: entry.backupFullBreakdown,
    });
  }
  return {
    title: entry.title,
    description: entry.description,
    fullBreakdown: entry.fullBreakdown,
    difficulty: entry.difficulty,
    questionCount: entry.questionCount,
    questions,
  };
}

function validateGenResult(parsed: GenResult, questionCount: number): void {
  if (
    !parsed.primary?.title ||
    !parsed.primary?.description ||
    !parsed.primary?.fullBreakdown
  ) {
    throw new AppError("Generated question missing required fields", 500);
  }
  if (
    questionCount > 1 &&
    (!parsed.backup?.title ||
      !parsed.backup?.description ||
      !parsed.backup?.fullBreakdown)
  ) {
    throw new AppError(
      "Generated backup question missing required fields",
      500,
    );
  }
}
