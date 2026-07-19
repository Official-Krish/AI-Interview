import { cacheGet, cacheSet, cacheDel } from "../lib/cache";

const IN_FLIGHT_TTL = 30;
const COMPLETED_TTL = 86_400;
const PREFIX = "idempot:";

export function withIdempotency(handler: (ctx: any) => any) {
  return async (ctx: any) => {
    const key = ctx.request?.headers?.get("Idempotency-Key")?.trim();
    if (!key) return handler(ctx);

    const cacheKey = `${PREFIX}${key}`;
    const existing = await cacheGet<string | { status: number; body: unknown }>(
      cacheKey,
    );

    if (existing) {
      if (existing === "IN_FLIGHT") {
        ctx.set.status = 409;
        return {
          error: "Request is already being processed",
          code: "IDEMPOTENCY_CONFLICT",
        };
      }
      const cached = existing as { status: number; body: unknown };
      ctx.set.status = cached.status;
      return cached.body;
    }

    await cacheSet(cacheKey, "IN_FLIGHT", IN_FLIGHT_TTL);

    try {
      const result = await handler(ctx);
      const status = ctx.set?.status ?? 200;
      await cacheSet(cacheKey, { status, body: result }, COMPLETED_TTL);
      return result;
    } catch (err) {
      await cacheDel(cacheKey);
      throw err;
    }
  };
}
