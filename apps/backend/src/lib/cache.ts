import { createClient } from "redis";

const host = process.env.REDIS_HOST ?? "localhost";

let client: ReturnType<typeof createClient> | null = null;
let connected = false;

const DEFAULT_TTL = 60;

export async function initCache() {
  client = createClient({ url: `redis://${host}:6379` });

  client.on("error", (err) => {
    connected = false;
    console.error("[cache] error:", err);
  });

  client.on("connect", () => {
    connected = true;
  });

  client.on("end", () => {
    connected = false;
  });

  try {
    await client.connect();
    connected = true;
  } catch (err) {
    console.error("[cache] failed to connect, caching disabled:", err);
    connected = false;
  }
}

function isReady(): boolean {
  return connected && client !== null;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isReady()) return null;
  try {
    const raw = await client!.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL,
): Promise<void> {
  if (!isReady()) return;
  try {
    const serialized = JSON.stringify(value);
    await client!.setEx(key, ttlSeconds, serialized);
  } catch {
    // silently fail — cache is optional
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!isReady()) return;
  try {
    await client!.del(key);
  } catch {
    // silently fail
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!isReady()) return;
  try {
    let cursor: any = 0;
    do {
      const result = await (client!.scan as any)(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = result.cursor;
      if (result.keys.length > 0) {
        await client!.del(result.keys);
      }
    } while (cursor !== 0);
  } catch {
    // silently fail
  }
}
