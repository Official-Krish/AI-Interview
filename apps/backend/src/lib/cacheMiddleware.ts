import { cacheGet, cacheSet } from "./cache";

export function cached(
  ttl: number,
  handler: (ctx: any) => any,
  keyFn?: (ctx: any) => string,
) {
  return async (ctx: any) => {
    let key = "";
    try {
      key = keyFn ? keyFn(ctx) : ctx.request.url;
      const cachedResult = await cacheGet(key);
      if (cachedResult !== null) return cachedResult;
    } catch {
      // Cache unavailable — fall through to handler
    }
    const result = await handler(ctx);
    if (key) {
      try {
        const status = ctx.set?.status;
        if (!status || (status >= 200 && status < 300)) {
          await cacheSet(key, result, ttl);
        }
      } catch {
        // Cache store failure — non-critical
      }
    }
    return result;
  };
}
