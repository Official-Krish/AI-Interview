import type { CandidateHistoryEntry } from "../types";

export function buildCandidateHistory(
  history: CandidateHistoryEntry[],
  overallMostImproved: string | null,
  overallWeakest: string | null,
  overallPatterns: string[],
  scoreTrendLast5: "improving" | "stable" | "declining" | null,
): string {
  if (history.length === 0 && overallPatterns.length === 0) return "";

  const lines: string[] = ["## Previous Interview History"];

  if (
    overallPatterns.length > 0 ||
    overallMostImproved ||
    overallWeakest ||
    scoreTrendLast5
  ) {
    lines.push("");
    if (scoreTrendLast5) {
      const trendMap = {
        improving: "Improving",
        stable: "Stable",
        declining: "Declining",
      };
      lines.push(`Overall trajectory: ${trendMap[scoreTrendLast5]}`);
    }
    if (overallMostImproved)
      lines.push(`Most improved area: ${overallMostImproved}`);
    if (overallWeakest) lines.push(`Weakest area: ${overallWeakest}`);
    if (overallPatterns.length > 0) {
      lines.push("Common patterns:", ...overallPatterns.map((p) => `- ${p}`));
    }
  }

  if (history.length > 0) {
    lines.push("", `Recent sessions (last ${history.length}):`);
    for (const [i, h] of history.entries()) {
      const scoreStr =
        h.overallScore != null
          ? ` — Score: ${Math.round(h.overallScore)}/100`
          : "";
      const modeStr = h.mode ? ` [${h.mode}]` : "";
      lines.push(
        "",
        `${i + 1}. ${h.date}${modeStr}${h.role ? ` — ${h.role}` : ""}${scoreStr}`,
      );
      if (h.strengths.length > 0)
        lines.push(`   Strengths: ${h.strengths.join(", ")}`);
      if (h.weaknesses.length > 0)
        lines.push(`   Weak areas: ${h.weaknesses.join(", ")}`);
    }
  }

  lines.push(
    "",
    "## How to use this history",
    "",
    "Use historical performance to personalize the interview, not to rehash it.",
    "",
    "Priority order:",
    "1. Current interview requirements (role, resume, job description)",
    "2. Aggregate skill profile trends (most improved, weakest, patterns)",
    "3. Recent interview history (last session context only)",
    "",
    "Guidelines:",
    "- Target areas that appear consistently weak across multiple sessions",
    "- Acknowledge demonstrated improvement when trends show upward movement",
    "- Do NOT repeatedly revisit weaknesses that have already improved significantly",
    '- Keep references high-level ("System design has been an area of focus — let\'s push deeper") — never quote specific past answers',
    "- If the candidate is improving, increase difficulty in that area",
    "- If the candidate is declining, check for fundamentals before advancing",
  );

  return lines.join("\n");
}
