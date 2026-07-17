import { cacheGet, cacheSet } from "./cache";

export function cached(
  ttl: number,
  handler: (ctx: any) => any,
  keyFn?: (ctx: any) => string,
) {
  return async (ctx: any) => {
    const key = keyFn ? keyFn(ctx) : ctx.request.url;
    const cachedResult = await cacheGet(key);
    if (cachedResult !== null) return cachedResult;
    const result = await handler(ctx);
    const status = ctx.set?.status;
    if (!status || (status >= 200 && status < 300)) {
      await cacheSet(key, result, ttl);
    }
    return result;
  };
}
