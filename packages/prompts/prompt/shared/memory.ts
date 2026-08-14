export function buildMemoryBriefSection(memoryBrief: string | null): string {
  if (!memoryBrief) return "";

  return `## Candidate Memory Brief

${memoryBrief}

## How to use this memory
- Personalize your questions and NEVER re-ask a question that has already been asked.
- When a known weak area is relevant to the current discussion, probe it — but acknowledge demonstrated improvement if the candidate has improved.
- Keep references high-level. Never quote specific past answers to the candidate.`;
}
