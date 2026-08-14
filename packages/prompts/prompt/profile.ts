import { FAILURE_SIGNALS } from "./constants/signals";

export function buildProfileAnalysisPrompt(params: {
  userName: string;
  position: string | null;
  companyName: string | null;
  interviewStyle: string | null;
  interviewDepth: string | null;
  strengths: string | null;
  weaknesses: string | null;
  overallScore: number | null;
  communicationScore: number | null;
  technicalScore: number | null;
  problemSolvingScore: number | null;
  turnCount: number;
}): string {
  const signalCodes = Object.keys(FAILURE_SIGNALS)
    .filter((k) => k !== "OTHER")
    .join(", ");

  return `Analyze this interview session and assess the candidate's skills.

Candidate: ${params.userName ?? "Unknown"}
Role: ${params.position ?? "Unknown"}
Company: ${params.companyName ?? "General"}
Style: ${params.interviewStyle ?? "PROFESSIONAL"}
Depth: ${params.interviewDepth ?? "STANDARD"}

Summary strengths: ${params.strengths}
Summary weaknesses: ${params.weaknesses}
Scores - Overall: ${params.overallScore}, Communication: ${params.communicationScore}, Technical: ${params.technicalScore}, Problem Solving: ${params.problemSolvingScore}
Turns: ${params.turnCount}

Based on the scores above, generate a JSON object:
{
  "communication": { "score": number, "note": "1-sentence assessment", "trend": "up"|"down"|"stable" },
  "technicalDepth": { "score": number, "note": "1-sentence assessment", "trend": "up"|"down"|"stable" },
  "problemSolving": { "score": number, "note": "1-sentence assessment", "trend": "up"|"down"|"stable" },
  "leadership": { "score": number, "note": "1-sentence assessment", "trend": "up"|"down"|"stable" },
  "patterns": ["string - observed patterns in this session"],
  "mostImprovedSkill": "string",
  "weakestSkill": "string",
  "signals": [
    {
      "code": "one of: ${signalCodes}",
      "turnIds": [1, 5],
      "reason": "1-sentence why this signal was observed"
    }
  ],
  "otherSignals": [
    {
      "label": "short descriptive label",
      "turnIds": [3],
      "reason": "1-sentence why"
    }
  ],
  "traits": {
    "analytical": { "score": number, "description": "1-sentence assessment" },
    "communication": { "score": number, "description": "1-sentence assessment" },
    "ownership": { "score": number, "description": "1-sentence assessment" },
    "adaptability": { "score": number, "description": "1-sentence assessment" },
    "decisionMaking": { "score": number, "description": "1-sentence assessment" },
    "influence": { "score": number, "description": "1-sentence assessment" }
  }
}

Select 0-N signals from the predefined taxonomy only (${signalCodes}). Use turnIds to reference turn orderNumbers (1-based). If none of the codes fit, use otherSignals with a descriptive label.

Assess the candidate's stable identity traits based on this session. Score each 0-100 and write a 1-sentence description for each.

Return ONLY valid JSON.`;
}
