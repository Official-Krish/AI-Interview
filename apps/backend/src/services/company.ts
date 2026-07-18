import { GoogleGenAI } from "@google/genai";
import { AppError } from "../lib/errors";
import { buildCompanyGenerationPrompt } from "../prompt/generation/company";

export class CompanyService {
  async generate(body: { companyName: string; industry?: string }) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY)
      throw new AppError("GEMINI_API_KEY not configured", 500);

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = buildCompanyGenerationPrompt({
      companyName: body.companyName,
      industry: body.industry ?? "Technology",
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

      return {
        company: {
          name: body.companyName,
          industry: body.industry ?? "Technology",
          personality: parsed.personality ?? "",
          roles: parsed.roles ?? [],
        },
      };
    } catch (err) {
      console.error("[company] generate failed:", err);
      throw new AppError("Failed to generate company context", 500);
    }
  }
}
