import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

interface DiscussionCacheEntry {
  title: string;
  description: string;
  fullBreakdown: string;
  backupTitle: string;
  backupDescription: string;
  backupFullBreakdown: string;
  difficulty: string;
  questionCount: number;
}

interface DiscussionCacheMeta {
  entry: DiscussionCacheEntry;
  createdAt: number;
  sessionIds: Set<string>;
}

const questionCache = new Map<string, DiscussionCacheMeta>();
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

export function getDiscussionQuestion(
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

export function cacheDiscussionQuestion(
  interviewId: string,
  roundLabel: string,
  depth: string,
  style: string,
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
  entry: DiscussionCacheEntry,
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

export function clearDiscussionQuestion(interviewId: string) {
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

const DISCUSSION_GENERATION_PROMPTS: Record<string, string> = {
  "Threat Modeling": `You are generating a threat modeling interview question. The question should test:
- Ability to identify threats and attack vectors in a system architecture
- Understanding of security principles (least privilege, defense in depth, etc.)
- Risk assessment and prioritization
- Mitigation strategy design`,

  "Paper Critique": `You are generating a paper critique interview question. The question should test:
- Understanding of the paper's core contribution and methodology
- Critical analysis of experimental design and results
- Ability to identify strengths, limitations, and confounding factors
- Suggestions for follow-up research or improvements`,

  "Quantitative Case": `You are generating a quantitative case study interview question. The question should test:
- Numerical reasoning and data interpretation
- Statistical analysis and probability
- Financial modeling and risk assessment
- Structured problem-solving with quantitative rigor`,

  "Mock Pitch": `You are generating a mock pitch interview question. The question should test:
- Understanding of the product/service being pitched
- Ability to identify customer needs and pain points
- Structured presentation and persuasive communication
- Handling objections and competitive positioning`,
};

const QUESTION_SCHEMA_SINGLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, specific scenario title",
    "description": "2-3 sentence description of the scenario",
    "fullBreakdown": "Detailed markdown with context, data, constraints, and the specific question to discuss. Do NOT repeat or summarize the description."
  }
}`;

const QUESTION_SCHEMA_DOUBLE = `Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A clear, specific scenario title",
    "description": "2-3 sentence description",
    "fullBreakdown": "Detailed markdown with context and question."
  },
  "backup": {
    "title": "A different scenario",
    "description": "2-3 sentence description",
    "fullBreakdown": "Same structure as primary, different topic."
  }
}

The two questions MUST be on different topics.`;

async function generateDiscussionQuestions(
  roundLabel: string,
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
  const basePrompt =
    DISCUSSION_GENERATION_PROMPTS[roundLabel] ??
    DISCUSSION_GENERATION_PROMPTS["Case Study"]!;
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
    questionCount === 1 ? QUESTION_SCHEMA_SINGLE : QUESTION_SCHEMA_DOUBLE;

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

export const discussionRoutes = new Elysia({ prefix: "/discussion" })
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
        if (interview.mode !== "DISCUSSION") {
          set.status = 400;
          return { error: "Interview is not in DISCUSSION mode" };
        }

        const roundLabel = (interview as { interviewRound?: string | null })
          .interviewRound;
        if (!roundLabel || !DISCUSSION_GENERATION_PROMPTS[roundLabel]) {
          set.status = 400;
          return { error: `Unsupported discussion round: ${roundLabel}` };
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

        const existing = getDiscussionQuestion(
          interviewId,
          roundLabel,
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
        const isProOrAdmin = userRole === "ADMIN" || userRole === "PRO";
        const questionCount = isProOrAdmin ? 2 : 1;

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
          set.status = 500;
          return { error: "Failed to generate question" };
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

        const entry: DiscussionCacheEntry = {
          title: parsed.primary.title,
          description: parsed.primary.description,
          fullBreakdown: parsed.primary.fullBreakdown,
          backupTitle: parsed.backup?.title ?? "",
          backupDescription: parsed.backup?.description ?? "",
          backupFullBreakdown: parsed.backup?.fullBreakdown ?? "",
          difficulty: depth,
          questionCount,
        };

        cacheDiscussionQuestion(
          interviewId,
          roundLabel,
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
