import type { PrismaClient, InterviewDepth, InterviewStyle } from "@evalio/db";
import { generateJson } from "@evalio/ai";
import {
  getCachedQuestion,
  setCachedQuestion,
  clearCachedQuestion,
} from "../lib/questionCache";
import { AppError, NotFoundError, ValidationError } from "../lib/errors";
import { buildSdGenerationPrompt } from "@evalio/prompts";

interface SdCacheEntry {
  title: string;
  description: string;
  fullBreakdown: string;
  backupTitle: string;
  backupDescription: string;
  backupFullBreakdown: string;
  difficulty: string;
  dbQuestionId: string | null;
}

function buildCacheKey(
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
): string {
  return `${roleCategory ?? "__none__"}::${companyName ?? "__none__"}::${position ?? "__none__"}`;
}

export function clearSdQuestion(interviewId: string) {
  clearCachedQuestion("sd", interviewId);
}

export async function getSdQuestion(
  interviewId: string,
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
) {
  return getCachedQuestion<SdCacheEntry>("sd", interviewId);
}

export class SystemDesignService {
  constructor(private prisma: PrismaClient) {}

  async startQuestion(userId: string, interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview || interview.userId !== userId)
      throw new NotFoundError("Interview not found");
    if (interview.mode !== "LIVE_CANVAS")
      throw new ValidationError("Interview is not in SYSTEM_DESIGN mode");

    const companyName = interview.companyName ?? null;
    const position = interview.position ?? null;
    const roleCategory =
      (interview as { roleCategory?: string | null }).roleCategory ?? null;
    const depth =
      (interview as { interviewDepth?: string }).interviewDepth || "PROBING";
    const style =
      (interview as { interviewStyle?: string }).interviewStyle ||
      "PROFESSIONAL";

    const existing = await getCachedQuestion<SdCacheEntry>("sd", interviewId);
    if (existing) {
      return {
        title: existing.title,
        description: existing.description,
        fullBreakdown: existing.fullBreakdown,
        difficulty: existing.difficulty,
      };
    }

    const fromDb = await this.pickFromDb(
      userId,
      companyName,
      position,
      roleCategory,
    );
    if (fromDb) {
      await setCachedQuestion(
        "sd",
        interviewId,
        buildCacheKey(roleCategory, companyName, position),
        fromDb,
      );
      return {
        title: fromDb.title,
        description: fromDb.description,
        fullBreakdown: fromDb.fullBreakdown,
        difficulty: fromDb.difficulty,
      };
    }

    const company = companyName || "a top tech company";
    const role = position || "a senior engineering role";

    const categoryContext = roleCategory
      ? `\nCategory: ${roleCategory} — tailor the question to this domain.`
      : "";
    const depthDirective =
      depth === "STANDARD"
        ? "pick a moderately complex system. Focus on core architecture."
        : depth === "PROBING"
          ? "pick a system with multiple interacting services or real-time constraints."
          : depth === "CHALLENGE"
            ? "pick a complex system with geo-distribution or data pipelines."
            : "pick an elite-level system. Multi-region, distributed consensus, or ML at scale.";

    const styleDirective =
      style === "SUPPORTIVE"
        ? "conversational and encouraging."
        : style === "CHALLENGING"
          ? "high-pressure, push for depth."
          : style === "BAR_RAISER"
            ? "surgical and precise."
            : "structured and neutral.";

    const generationPrompt = buildSdGenerationPrompt({
      company,
      role,
      categoryContext,
      depth,
      depthDirective,
      style,
      styleDirective,
    });

    let parsed: {
      primary: { title: string; description: string; fullBreakdown: string };
      backup: { title: string; description: string; fullBreakdown: string };
    };
    try {
      parsed = await generateJson<{
        primary: { title: string; description: string; fullBreakdown: string };
        backup: { title: string; description: string; fullBreakdown: string };
      }>({ prompt: generationPrompt });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[sd/start] generation failed:", message);
      throw new AppError("Failed to generate question", 500);
    }

    if (
      !parsed.primary?.title ||
      !parsed.primary?.description ||
      !parsed.primary?.fullBreakdown ||
      !parsed.backup?.title ||
      !parsed.backup?.description ||
      !parsed.backup?.fullBreakdown
    ) {
      throw new AppError("Generated question missing required fields", 500);
    }

    const saved = await this.prisma.systemDesignQuestion.create({
      data: {
        companyName,
        position,
        roleCategory,
        interviewDepth: depth as InterviewDepth,
        interviewStyle: style as InterviewStyle,
        title: parsed.primary.title,
        description: parsed.primary.description,
        fullBreakdown: parsed.primary.fullBreakdown,
        backupTitle: parsed.backup.title,
        backupDescription: parsed.backup.description,
        backupFullBreakdown: parsed.backup.fullBreakdown,
      },
    });

    const entry: SdCacheEntry = {
      title: parsed.primary.title,
      description: parsed.primary.description,
      fullBreakdown: parsed.primary.fullBreakdown,
      backupTitle: parsed.backup.title,
      backupDescription: parsed.backup.description,
      backupFullBreakdown: parsed.backup.fullBreakdown,
      difficulty: depth,
      dbQuestionId: saved.id,
    };

    await setCachedQuestion(
      "sd",
      interviewId,
      buildCacheKey(roleCategory, companyName, position),
      entry,
    );
    await this.recordSeen(userId, saved.id, interviewId);

    return {
      title: entry.title,
      description: entry.description,
      fullBreakdown: entry.fullBreakdown,
      difficulty: entry.difficulty,
    };
  }

  private async recordSeen(
    userId: string,
    questionId: string,
    interviewId: string,
  ) {
    await this.prisma.sdQuestionSeenByUser.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: { seenAt: new Date(), interviewId },
      create: { userId, questionId, interviewId },
    });
  }

  private async pickFromDb(
    userId: string,
    companyName: string | null,
    position: string | null,
    roleCategory: string | null,
  ): Promise<(SdCacheEntry & { dbQuestionId: string }) | null> {
    const seenIds = (
      await this.prisma.sdQuestionSeenByUser.findMany({
        where: { userId },
        select: { questionId: true },
      })
    ).map((r) => r.questionId);

    const where: Record<string, unknown> = {};
    if (companyName) {
      where.companyName = companyName;
      if (position) where.position = position;
    }
    if (roleCategory) where.roleCategory = roleCategory;
    if (seenIds.length > 0) where.id = { notIn: seenIds };

    const pool = await this.prisma.systemDesignQuestion.findMany({ where });
    if (pool.length === 0) return null;

    const pick = pool[Math.floor(Math.random() * pool.length)]!;

    await this.prisma.systemDesignQuestion.update({
      where: { id: pick.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      title: pick.title,
      description: pick.description,
      fullBreakdown: pick.fullBreakdown,
      backupTitle: pick.backupTitle ?? "",
      backupDescription: pick.backupDescription ?? "",
      backupFullBreakdown: pick.backupFullBreakdown ?? "",
      difficulty: pick.interviewDepth,
      dbQuestionId: pick.id,
    };
  }
}
