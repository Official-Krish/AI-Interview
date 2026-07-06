import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

interface CaseStudyCacheEntry {
  title: string;
  description: string;
  fullBreakdown: string;
  backupTitle: string;
  backupDescription: string;
  backupFullBreakdown: string;
  difficulty: string;
  questionCount: number;
}

interface CaseStudyCacheMeta {
  entry: CaseStudyCacheEntry;
  createdAt: number;
  sessionIds: Set<string>;
}

const questionCache = new Map<string, CaseStudyCacheMeta>();
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX_ENTRIES = 100;
const cacheAccessOrder: string[] = [];

function evictIfNeeded() {
  if (questionCache.size < CACHE_MAX_ENTRIES) return;
  const oldest = cacheAccessOrder.shift();
  if (oldest) questionCache.delete(oldest);
}

function touchCacheKey(key: string) {
  const idx = cacheAccessOrder.indexOf(key);
  if (idx !== -1) cacheAccessOrder.splice(idx, 1);
  cacheAccessOrder.push(key);
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

export function getCaseStudyQuestion(
  interviewId: string,
  roundLabel: string,
  depth: string,
  style: string,
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
) {
  for (const [key, meta] of questionCache) {
    if (meta.sessionIds.has(interviewId)) {
      touchCacheKey(key);
      return meta.entry;
    }
  }
  const key = buildCacheKey(
    roundLabel,
    depth,
    style,
    roleCategory,
    companyName,
    position,
  );
  const meta = questionCache.get(key);
  if (meta) {
    meta.sessionIds.add(interviewId);
    touchCacheKey(key);
    return meta.entry;
  }
  return null;
}

export function cacheCaseStudyQuestion(
  interviewId: string,
  roundLabel: string,
  depth: string,
  style: string,
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
  entry: CaseStudyCacheEntry,
) {
  const key = buildCacheKey(
    roundLabel,
    depth,
    style,
    roleCategory,
    companyName,
    position,
  );
  evictIfNeeded();
  const existing = questionCache.get(key);
  if (existing) {
    existing.sessionIds.add(interviewId);
    existing.entry = entry;
    existing.createdAt = Date.now();
    touchCacheKey(key);
    return;
  }
  questionCache.set(key, {
    entry,
    createdAt: Date.now(),
    sessionIds: new Set([interviewId]),
  });
  touchCacheKey(key);
}

export function clearCaseStudyQuestion(interviewId: string) {
  for (const [, meta] of questionCache) {
    meta.sessionIds.delete(interviewId);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, meta] of questionCache) {
    if (now - meta.createdAt > CACHE_TTL_MS) {
      questionCache.delete(key);
      const idx = cacheAccessOrder.indexOf(key);
      if (idx !== -1) cacheAccessOrder.splice(idx, 1);
    }
  }
}, 60_000);

const CASE_STUDY_PROMPT = `You are generating a case study interview question for a consulting or business strategy interview. The question should test:
- Problem structuring and hypothesis-driven thinking
- Analytical reasoning and data interpretation
- Business judgment and strategic recommendations
- Communication and stakeholder management
- Ability to handle ambiguity and changing constraints`;

const QUESTION_SCHEMA_SINGLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, concise business case title",
    "description": "2-3 sentence overview of the business scenario and the core question to answer",
    "fullBreakdown": "Detailed markdown with: company context, market situation, key data points (revenue, costs, market size, growth rates), stakeholder perspectives, constraints, and the specific question the candidate must answer. Include enough detail for a thorough case analysis. Do NOT repeat or summarize the description."
  }
}`;

const QUESTION_SCHEMA_DOUBLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, concise business case title",
    "description": "2-3 sentence overview of the business scenario and the core question to answer",
    "fullBreakdown": "Detailed markdown with: company context, market situation, key data points, stakeholder perspectives, constraints, and the specific question the candidate must answer."
  },
  "backup": {
    "title": "A different business case title",
    "description": "2-3 sentence overview",
    "fullBreakdown": "Same structure as primary, different business scenario."
  }
}

The two questions MUST be on different business domains or scenarios.`;

async function generateCaseStudyQuestions(
  company: string,
  role: string,
  depth: string,
  style: string,
  roleCategory: string | null,
  questionCount: number,
): Promise<{
  primary: { title: string; description: string; fullBreakdown: string };
  backup?: { title: string; description: string; fullBreakdown: string };
}> {
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
    questionCount === 1 ? QUESTION_SCHEMA_SINGLE : QUESTION_SCHEMA_DOUBLE;

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

export const caseStudyRoutes = new Elysia({ prefix: "/case-study" })
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
        if ((interview as { mode: string }).mode !== "DISCUSSION") {
          set.status = 400;
          return { error: "Interview is not in DISCUSSION mode" };
        }

        const roundLabel = (interview as { interviewRound?: string | null })
          .interviewRound;
        if (roundLabel !== "Case Study") {
          set.status = 400;
          return { error: `Unsupported round: ${roundLabel}` };
        }

        const companyName = interview.companyName ?? null;
        const position = interview.position ?? null;
        const roleCategory =
          (interview as { roleCategory?: string | null }).roleCategory ?? null;

        const depth =
          (interview as { interviewDepth?: string }).interviewDepth ||
          "PROBING";
        const style =
          (interview as { interviewStyle?: string }).interviewStyle ||
          "PROFESSIONAL";

        const existing = getCaseStudyQuestion(
          interviewId,
          "Case Study",
          depth,
          style,
          roleCategory,
          companyName,
          position,
        );
        if (existing) {
          const questions = [
            {
              title: existing.title,
              description: existing.description,
              fullBreakdown: existing.fullBreakdown,
            },
          ];
          if (existing.questionCount > 1 && existing.backupTitle) {
            questions.push({
              title: existing.backupTitle,
              description: existing.backupDescription,
              fullBreakdown: existing.backupFullBreakdown,
            });
          }
          return {
            title: existing.title,
            description: existing.description,
            fullBreakdown: existing.fullBreakdown,
            difficulty: existing.difficulty,
            questionCount: existing.questionCount,
            questions,
          };
        }

        const userRecord = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        const userRole = userRecord?.role ?? "FREE";
        const isEngineering = roleCategory === "engineering";
        const isProOrAdmin = userRole === "ADMIN" || userRole === "PRO";
        const is30Min = isEngineering || isProOrAdmin;
        const questionCount = is30Min ? 2 : 1;

        const company = companyName || "a top company";
        const role = position || "a senior role";

        let parsed: {
          primary: {
            title: string;
            description: string;
            fullBreakdown: string;
          };
          backup?: {
            title: string;
            description: string;
            fullBreakdown: string;
          };
        };
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
          set.status = 500;
          return { error: "Failed to generate case study question" };
        }

        if (
          !parsed.primary?.title ||
          !parsed.primary?.description ||
          !parsed.primary?.fullBreakdown
        ) {
          set.status = 500;
          return { error: "Generated question missing required fields" };
        }

        if (
          questionCount > 1 &&
          (!parsed.backup?.title ||
            !parsed.backup?.description ||
            !parsed.backup?.fullBreakdown)
        ) {
          set.status = 500;
          return { error: "Generated backup question missing required fields" };
        }

        const entry: CaseStudyCacheEntry = {
          title: parsed.primary.title,
          description: parsed.primary.description,
          fullBreakdown: parsed.primary.fullBreakdown,
          backupTitle: parsed.backup?.title ?? "",
          backupDescription: parsed.backup?.description ?? "",
          backupFullBreakdown: parsed.backup?.fullBreakdown ?? "",
          difficulty: depth,
          questionCount,
        };

        cacheCaseStudyQuestion(
          interviewId,
          "Case Study",
          depth,
          style,
          roleCategory,
          companyName,
          position,
          entry,
        );

        const questions = [
          {
            title: parsed.primary.title,
            description: parsed.primary.description,
            fullBreakdown: parsed.primary.fullBreakdown,
          },
        ];
        if (parsed.backup) {
          questions.push({
            title: parsed.backup.title,
            description: parsed.backup.description,
            fullBreakdown: parsed.backup.fullBreakdown,
          });
        }

        return {
          title: entry.title,
          description: entry.description,
          fullBreakdown: entry.fullBreakdown,
          difficulty: entry.difficulty,
          questionCount,
          questions,
        };
      },
      {
        body: t.Object({
          interviewId: t.String(),
        }),
      },
    ),
  );
