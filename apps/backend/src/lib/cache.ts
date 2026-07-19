import { createClient } from "redis";
import { logger } from "./logger";

const host = process.env.REDIS_HOST ?? "localhost";

let client: ReturnType<typeof createClient> | null = null;

const DEFAULT_TTL = 60;

// Circuit breaker state
let failureCount = 0;
const FAILURE_THRESHOLD = 3;
let lastFailureTime = 0;
const HALF_OPEN_WINDOW_MS = 15_000;
let circuitOpen = false;

function recordFailure(): void {
  failureCount++;
  lastFailureTime = Date.now();
  if (failureCount >= FAILURE_THRESHOLD) {
    circuitOpen = true;
    logger.warn("cache.circuit_open", {
      failureCount,
      threshold: FAILURE_THRESHOLD,
    });
  }
}

function recordSuccess(): void {
  if (circuitOpen) {
    logger.info("cache.circuit_closed", { failureCount });
  }
  failureCount = 0;
  circuitOpen = false;
}

function canAttempt(): boolean {
  if (!circuitOpen) return true;
  const elapsed = Date.now() - lastFailureTime;
  if (elapsed >= HALF_OPEN_WINDOW_MS) {
    circuitOpen = false;
    logger.info("cache.circuit_half_open", { elapsed });
    return true;
  }
  return false;
}

export async function initCache() {
  client = createClient({ url: `redis://${host}:6379` });

  client.on("error", (err) => {
    recordFailure();
    logger.error("cache.error", { err });
  });

  client.on("connect", () => {
    recordSuccess();
  });

  client.on("end", () => {
    recordFailure();
  });

  try {
    await client.connect();
    recordSuccess();
  } catch (err) {
    recordFailure();
    logger.error("cache.init_failed", { err });
  }
}

function isReady(): boolean {
  if (client === null) return false;
  if (!circuitOpen) return true;
  return canAttempt();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isReady()) return null;
  try {
    const raw = await client!.get(key);
    if (!raw) return null;
    recordSuccess();
    return JSON.parse(raw) as T;
  } catch (err) {
    recordFailure();
    logger.error("cache.get_error", { key, err });
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
    recordSuccess();
  } catch (err) {
    recordFailure();
    logger.error("cache.set_error", { key, err });
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!isReady()) return;
  try {
    await client!.del(key);
    recordSuccess();
  } catch (err) {
    recordFailure();
    logger.error("cache.del_error", { key, err });
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
    recordSuccess();
  } catch (err) {
    recordFailure();
    logger.error("cache.del_pattern_error", { pattern, err });
  }
}
