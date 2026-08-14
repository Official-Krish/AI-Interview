import { AppError } from "../lib/errors";
import { generateJson } from "../lib/ai";
import { buildCompanyGenerationPrompt } from "../prompt/generation/company";

export class CompanyService {
  async generate(body: { companyName: string; industry?: string }) {
    const prompt = buildCompanyGenerationPrompt({
      companyName: body.companyName,
      industry: body.industry ?? "Technology",
    });

    try {
      const parsed = await generateJson<{
        personality?: string;
        roles?: unknown[];
      }>({ prompt });

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
