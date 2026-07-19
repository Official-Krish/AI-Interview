import { prisma } from "../lib/prisma";
import { GoogleGenAI } from "@google/genai";
import type { FailureSignalCode } from "../constants/signals";
import { buildProfileAnalysisPrompt } from "../prompt/profile";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type Json = Record<string, unknown>;

async function readJson<T = Json>(val: unknown): Promise<T[]> {
  if (Array.isArray(val)) return val as T[];
  try {
    if (typeof val === "string") return JSON.parse(val) as T[];
  } catch {
    /* ignore */
  }
  return [];
}

function simplify(val: unknown): Json[] {
  if (Array.isArray(val)) return val as Json[];
  return [];
}

export class ProfileService {
  async getSkills(userId: string) {
    const profile = await prisma.candidateSkillProfile.findUnique({
      where: { userId },
    });
    return { profile };
  }
}

export async function updateCandidateProfile(interviewId: string) {
  const interview = await prisma.interviewSession.findUnique({
    where: { id: interviewId },
    include: {
      summary: true,
      turns: { orderBy: { orderNumber: "asc" } },
      user: { select: { name: true } },
    },
  });

  if (!interview || !interview.summary) return;

  const existing = await prisma.candidateSkillProfile.findUnique({
    where: { userId: interview.userId },
  });

  if (!GEMINI_API_KEY) return;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const prompt = buildProfileAnalysisPrompt({
    userName: interview.user.name ?? "Unknown",
    position: interview.position,
    companyName: interview.companyName,
    interviewStyle: interview.interviewStyle,
    interviewDepth: interview.interviewDepth,
    strengths: JSON.stringify(interview.summary.strengths),
    weaknesses: JSON.stringify(interview.summary.weaknesses),
    overallScore: interview.overallScore,
    communicationScore: interview.communicationScore,
    technicalScore: interview.technicalScore,
    problemSolvingScore: interview.problemSolvingScore,
    turnCount: interview.turns.length,
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text ?? "";
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    const makeEntry = (field: string) => ({
      score: parsed[field]?.score ?? 0,
      note: parsed[field]?.note ?? "",
      interviewId,
      date: new Date().toISOString(),
    });

    const prevComm = simplify(existing?.communication);
    const prevTech = simplify(existing?.technicalDepth);
    const prevProb = simplify(existing?.problemSolving);
    const prevLead = simplify(existing?.leadership);
    const prevPatterns = await readJson<string>(existing?.commonPatterns);
    const prevSignals = await readJson<Json>(existing?.patternSignals);

    const newPatterns = [
      ...new Set([...prevPatterns, ...(parsed.patterns ?? [])]),
    ];

    const turnIdByOrder = new Map(
      interview.turns.map((t) => [t.orderNumber, t.id]),
    );

    const mappedSignals = (parsed.signals ?? []).map(
      (s: { code: string; turnIds?: number[]; reason?: string }) => ({
        code: s.code as FailureSignalCode,
        turnIds: (s.turnIds ?? [])
          .map((n: number) => turnIdByOrder.get(n))
          .filter(Boolean),
        reason: s.reason ?? "",
      }),
    );

    const mappedOther = (parsed.otherSignals ?? []).map(
      (s: { label: string; turnIds?: number[]; reason?: string }) => ({
        code: "OTHER" as const,
        label: s.label,
        turnIds: (s.turnIds ?? [])
          .map((n: number) => turnIdByOrder.get(n))
          .filter(Boolean),
        reason: s.reason ?? "",
      }),
    );

    const signalEntry = {
      interviewId,
      date: new Date().toISOString(),
      signals: [...mappedSignals, ...mappedOther],
    };

    const updatedSignals = [...prevSignals, signalEntry];

    const rawTraits = parsed.traits as
      | Record<string, { score?: number; description?: string }>
      | undefined;
    const traitEntry = rawTraits
      ? {
          interviewId,
          date: new Date().toISOString(),
          traits: Object.fromEntries(
            Object.entries(rawTraits).map(([k, v]) => [
              k,
              { score: v?.score ?? 0, description: v?.description ?? "" },
            ]),
          ),
        }
      : null;

    const prevTraitHistory = await readJson<Json>(existing?.traitHistory);
    const updatedTraitHistory = traitEntry
      ? [...prevTraitHistory, traitEntry]
      : prevTraitHistory;

    await prisma.candidateSkillProfile.upsert({
      where: { userId: interview.userId },
      create: {
        userId: interview.userId,
        communication: JSON.stringify([
          ...prevComm.slice(-9),
          makeEntry("communication"),
        ]),
        technicalDepth: JSON.stringify([
          ...prevTech.slice(-9),
          makeEntry("technicalDepth"),
        ]),
        problemSolving: JSON.stringify([
          ...prevProb.slice(-9),
          makeEntry("problemSolving"),
        ]),
        leadership: JSON.stringify([
          ...prevLead.slice(-9),
          makeEntry("leadership"),
        ]),
        commonPatterns: JSON.stringify(newPatterns),
        patternSignals: JSON.stringify(updatedSignals),
        traitHistory: JSON.stringify(updatedTraitHistory),
        mostImprovedSkill: parsed.mostImprovedSkill ?? null,
        weakestSkill: parsed.weakestSkill ?? null,
      },
      update: {
        communication: JSON.stringify([
          ...prevComm.slice(-9),
          makeEntry("communication"),
        ]),
        technicalDepth: JSON.stringify([
          ...prevTech.slice(-9),
          makeEntry("technicalDepth"),
        ]),
        problemSolving: JSON.stringify([
          ...prevProb.slice(-9),
          makeEntry("problemSolving"),
        ]),
        leadership: JSON.stringify([
          ...prevLead.slice(-9),
          makeEntry("leadership"),
        ]),
        commonPatterns: JSON.stringify(newPatterns),
        patternSignals: JSON.stringify(updatedSignals),
        traitHistory: JSON.stringify(updatedTraitHistory),
        mostImprovedSkill: parsed.mostImprovedSkill ?? undefined,
        weakestSkill: parsed.weakestSkill ?? undefined,
      },
    });
  } catch (err) {
    console.error("[profile] update failed:", err);
  }
}
