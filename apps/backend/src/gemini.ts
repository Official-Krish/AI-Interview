import { EventEmitter } from "node:events";
import { GoogleGenAI, Modality, type Session } from "@google/genai";
import { FUNCTION_DECLARATIONS } from "./ws/tools";

// 100 ms of 16-bit PCM silence at 16 kHz (1600 zero samples = 3200 zero bytes)
const SILENT_PCM_BASE64 = Buffer.alloc(3200).toString("base64");
const PCM_MIME = "audio/pcm;rate=16000";

function sendCompleteTurn(session: Session) {
  // Send a synthetic silent audio frame to trigger model response
  session.sendRealtimeInput({
    media: { data: SILENT_PCM_BASE64, mimeType: PCM_MIME },
  });
  session.sendRealtimeInput({ audioStreamEnd: true });
}

export interface GeminiSession {
  on(
    event: "message" | "error" | "close",
    listener: (...args: unknown[]) => void,
  ): this;
  send(data: string): void;
  close(): void;
}

const ai = new GoogleGenAI({
  apiKey: Bun.env.GEMINI_API_KEY,
});

class GeminiSessionAdapter implements GeminiSession {
  constructor(
    private readonly session: Session,
    private readonly bus: EventEmitter,
  ) {}

  on(
    event: "message" | "error" | "close",
    listener: (...args: unknown[]) => void,
  ): this {
    this.bus.on(event, listener);
    return this;
  }

  send(data: string) {
    try {
      const message = JSON.parse(data) as {
        clientContent?: {
          turns?: Array<Record<string, unknown>>;
          turnComplete?: boolean;
        };
        realtimeInput?: {
          audioStreamEnd?: boolean;
          completeTurn?: boolean;
          text?: string;
          mediaChunks?: Array<{
            mimeType?: string;
            data?: string;
          }>;
        };
      };

      if (message.clientContent) {
        this.session.sendClientContent({
          turns: message.clientContent.turns?.length
            ? (message.clientContent.turns as Array<{
                role?: string;
                parts?: Array<Record<string, unknown>>;
              }>)
            : undefined,
          turnComplete: message.clientContent.turnComplete,
        });
        return;
      }

      // audioStreamEnd signals the end of a user's audio turn
      if (message.realtimeInput?.audioStreamEnd) {
        this.session.sendRealtimeInput({ audioStreamEnd: true });
        return;
      }

      // Forward audio chunks
      for (const chunk of message.realtimeInput?.mediaChunks ?? []) {
        if (!chunk.data || !chunk.mimeType) continue;
        this.session.sendRealtimeInput({
          media: { data: chunk.data, mimeType: chunk.mimeType },
        });
      }

      // Text injection via realtimeInput — sends text without any activity
      // signal so the model absorbs it silently into context.
      if (message.realtimeInput?.text !== undefined) {
        this.session.sendRealtimeInput({ text: message.realtimeInput.text });
        if (message.realtimeInput.completeTurn) {
          sendCompleteTurn(this.session);
        }
        return;
      }

      // completeTurn without text: synthetic user turn to trigger a model
      // response (e.g. initial bootstrap, canvas-only turn complete).
      if (message.realtimeInput?.completeTurn) {
        sendCompleteTurn(this.session);
        return;
      }
    } catch (err) {
      console.error("[gemini adapter] send failed:", err);
    }
  }

  close() {
    try {
      this.session.close();
    } catch (err) {
      console.error("[gemini adapter] close failed:", err);
    }
  }
}

export async function createGeminiSession(
  systemPrompt: string,
  enabledToolNames?: string[],
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY env not set");
  const bus = new EventEmitter();
  bus.setMaxListeners(20);

  const filteredDeclarations =
    enabledToolNames === undefined
      ? FUNCTION_DECLARATIONS
      : FUNCTION_DECLARATIONS.filter((fd: { name: string }) =>
          enabledToolNames.includes(fd.name),
        );

  const session = await ai.live.connect({
    model: "gemini-2.5-flash-native-audio-preview-12-2025",
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: systemPrompt,
      // tools: [{ functionDeclarations: filteredDeclarations }],
    },
    callbacks: {
      onmessage: (message) => {
        try {
          const json = JSON.stringify(message);
          // Log message content summary (skip verbose audio-only chunks)
          if (message.serverContent?.modelTurn?.parts) {
            const hasAudio = message.serverContent.modelTurn.parts.some(
              (p) => "inlineData" in p,
            );
            const hasText = message.serverContent.modelTurn.parts.some(
              (p) => "text" in p,
            );
            const hasFnCall = message.serverContent.modelTurn.parts.some(
              (p) => "functionCall" in p,
            );
            console.log(
              `[gemini SDK] serverContent turnComplete=${!!message.serverContent.turnComplete} audio=${hasAudio} text=${hasText} functionCall=${hasFnCall} parts=${message.serverContent.modelTurn.parts.length}`,
            );
          } else if (message.serverContent?.turnComplete) {
            console.log("[gemini SDK] turnComplete (no parts)");
          } else {
            const sanitized = JSON.parse(json) as Record<string, unknown>;
            if (
              typeof sanitized.clientContent === "object" &&
              sanitized.clientContent
            ) {
              (sanitized.clientContent as Record<string, unknown>).turns =
                "[redacted]";
            }
            if (sanitized.realtimeInput) {
              sanitized.realtimeInput = "[redacted]";
            }
            console.log(
              "[gemini SDK] message:",
              JSON.stringify(sanitized).slice(0, 200),
            );
          }
          bus.emit("message", Buffer.from(json));
        } catch (err) {
          console.error("[gemini SDK] onmessage error:", err);
        }
      },
      onerror: (event) => {
        const detail =
          typeof event.error === "object"
            ? JSON.stringify(event.error).slice(0, 300)
            : String(event.error);
        console.error("[gemini SDK] error:", detail);
        const error =
          event.error instanceof Error
            ? event.error
            : new Error(`Gemini Live API error: ${detail}`);
        bus.emit("error", error);
      },
      onclose: (event) => {
        console.log(
          `[gemini SDK] closed code=${event.code} reason="${event.reason}"`,
        );
        bus.emit("close", event.code, event.reason);
      },
    },
  });

  return new GeminiSessionAdapter(session, bus);
}
