import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const BASE_URL = "https://integrate.api.nvidia.com/v1";
const MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const API_KEY = Bun.env.NVIDIA_API_KEY;

export class AIError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AIError";
  }
}

type Role = "system" | "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  attempts?: number;
  thinking?: boolean;
  responseFormat?: Record<string, unknown>;
}

interface GenerateTextOptions {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  attempts?: number;
}

interface GenerateJsonOptions<T> {
  prompt: string;
  system?: string;
  jsonSchema?: Record<string, unknown>;
  schema?: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  attempts?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(4000, 500 * 2 ** attempt) + Math.random() * 250;
}

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!API_KEY) throw new AIError("NVIDIA_API_KEY not set");
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
      timeout: 120_000,
      maxRetries: 3,
    });
  }
  return openaiClient;
}

async function chatCompletion(
  messages: Message[],
  opts: ChatOptions = {},
): Promise<string> {
  const client = getOpenAI();
  const attempts = opts.attempts ?? 3;

  const buildBody = (thinking: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2048,
      stream: false,
    };
    if (opts.responseFormat) body.response_format = opts.responseFormat;
    // Nemotron is a reasoning model — disable thinking so JSON parsing stays
    // clean. Some hosted endpoints reject this non-standard field.
    if (!thinking) body.chat_template_kwargs = { enable_thinking: false };
    return body;
  };

  let lastError: unknown;
  let thinking = opts.thinking ?? false;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const completion = await client.chat.completions.create(
        buildBody(thinking) as never,
      );
      const content = completion.choices?.[0]?.message?.content;
      if (!content) throw new AIError("Empty response from NVIDIA");
      return content;
    } catch (err) {
      lastError = err;

      // If the hosted endpoint rejected chat_template_kwargs, retry without it.
      if (
        thinking === false &&
        err instanceof OpenAI.APIError &&
        err.status === 400 &&
        attempt < attempts - 1
      ) {
        thinking = true;
        await sleep(backoffMs(attempt));
        continue;
      }

      const retryable =
        err instanceof OpenAI.APIError &&
        (err.status === 429 || (err.status ?? 500) >= 500);
      if (retryable && attempt < attempts - 1) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new AIError(
        err instanceof Error ? err.message : String(err),
        err instanceof OpenAI.APIError ? err.status : undefined,
      );
    }
  }
  throw lastError;
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1]!.trim() : trimmed;
}

function parseJson<T>(text: string, schema?: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const arrStart = text.indexOf("[");
    const arrEnd = text.lastIndexOf("]");
    let candidate = "";
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      candidate = text.slice(jsonStart, jsonEnd + 1);
    } else if (arrStart !== -1 && arrEnd > arrStart) {
      candidate = text.slice(arrStart, arrEnd + 1);
    }
    if (!candidate) throw new AIError("Failed to parse JSON from model output");
    try {
      parsed = JSON.parse(candidate);
    } catch {
      throw new AIError("Failed to parse JSON from model output");
    }
  }

  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new AIError(`JSON validation failed: ${result.error.message}`);
    }
    return result.data;
  }
  return parsed as T;
}

export async function generateText(opts: GenerateTextOptions): Promise<string> {
  const messages: Message[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  return chatCompletion(messages, {
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    attempts: opts.attempts,
  });
}

export async function generateJson<T>(
  opts: GenerateJsonOptions<T>,
): Promise<T> {
  const messages: Message[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({
    role: "user",
    content: `${opts.prompt}\n\nReturn ONLY valid JSON. Do not wrap it in code fences or add any text outside the JSON.`,
  });

  const baseOpts = {
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    attempts: opts.attempts,
  };

  // Strategy 1: strict JSON schema (guided decoding on NIM)
  if (opts.jsonSchema) {
    try {
      const content = await chatCompletion(messages, {
        ...baseOpts,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: true,
            schema: opts.jsonSchema,
          },
        },
      });
      return parseJson<T>(content, opts.schema);
    } catch (err) {
      // Never cascade a rate-limit exhaustion into more strategies (3x load).
      if (err instanceof AIError && err.status === 429) throw err;
      console.warn(
        "[ai] json_schema mode failed, falling back to json_object:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Strategy 2: json_object mode
  try {
    const content = await chatCompletion(messages, {
      ...baseOpts,
      responseFormat: { type: "json_object" },
    });
    return parseJson<T>(content, opts.schema);
  } catch (err) {
    if (err instanceof AIError && err.status === 429) throw err;
    console.warn(
      "[ai] json_object mode failed, falling back to plain text:",
      err instanceof Error ? err.message : err,
    );
  }

  // Strategy 3: plain completion + robust parse
  const content = await chatCompletion(messages, baseOpts);
  return parseJson<T>(content, opts.schema);
}

// ── Embeddings (Gemini text-embedding-004) ──

let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  const apiKey = Bun.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new AIError("GEMINI_API_KEY not set (required for embeddings)");
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
}

export async function embed(text: string): Promise<number[]> {
  try {
    const ai = getGemini();
    const res = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: [{ role: "user", parts: [{ text }] }],
    });
    const values = res.embeddings?.[0]?.values;
    if (!values) throw new AIError("Empty embedding response from Gemini");
    return values;
  } catch (err) {
    if (err instanceof AIError) throw err;
    throw new AIError(
      `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
