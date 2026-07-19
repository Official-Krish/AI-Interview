import { Elysia } from "elysia";
import { logger } from "../lib/logger";

let counter = 0;

function generateRequestId(): string {
  counter = (counter + 1) % 999999;
  return `${Date.now().toString(36)}-${counter.toString(36).padStart(4, "0")}`;
}

export const requestLogger = new Elysia()
  .onRequest(({ request, store }) => {
    const requestId = generateRequestId();
    (store as Record<string, unknown>).requestId = requestId;

    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/ready") return;

    logger.info("request", {
      requestId,
      method: request.method,
      path: url.pathname,
      query: url.search || undefined,
    });
  })
  .onAfterResponse(({ request, store, set }) => {
    const requestId = (store as Record<string, unknown>).requestId as
      | string
      | undefined;
    if (!requestId) return;

    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/ready") return;

    logger.info("response", {
      requestId,
      method: request.method,
      path: url.pathname,
      status: set.status,
    });
  });
