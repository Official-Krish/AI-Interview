export function buildCompanyContext(
  companyName: string | null,
  culture: string[] | null,
  interviewerBehavior: string[] | null,
  interviewDepth?: string | null,
): string {
  if (!companyName) return "";

  const lines: string[] = [`## Interview Context\nCompany: ${companyName}`];

  if (culture && culture.length > 0) {
    lines.push("", "Culture:", ...culture.map((c) => `- ${c}`));
  }

  if (interviewerBehavior && interviewerBehavior.length > 0) {
    lines.push(
      "",
      "Interviewer Approach:",
      ...interviewerBehavior.map((b) => `- ${b}`),
    );
  }

  lines.push(
    "",
    "## Difficulty Adaptation",
    `Use your knowledge of ${companyName} to calibrate the interview difficulty. Base the difficulty roughly 65% on what you know about this company's interview standards and 35% on the user-selected depth setting (${interviewDepth ?? "STANDARD"}).`,
    `- If ${companyName} is known for rigorous interviews (FAANG, trading firms, elite tech), set a high bar regardless of the user's depth setting.`,
    `- If ${companyName} is a consulting firm, agency, or mid-size company, focus on practical problem-solving and clarity over theoretical depth.`,
    `- If ${companyName} is a startup, balance depth with practical skills and adaptability.`,
    `Let the company's reputation be the primary driver (65%), and use the user's selected depth (${interviewDepth ?? "STANDARD"}) to fine-tune (35%) — for example, "CHALLENGE" or "BAR_RAISER" should push rigor higher even at a less intense company, while "STANDARD" at an elite company should still be demanding but not overwhelming.`,
  );

  return lines.join("\n");
}
