import { redisSubscriber } from "./redis";
import { logger } from "./logger";

const MAX_CONCURRENT = parseInt(Bun.env.MAX_CONCURRENT_SESSIONS ?? "4");

const ACTIVE_SET = "queue:active";
const WAITING_SORTED = "queue:waiting";
const META_PREFIX = "queue:meta:";

function safeRedis<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return fn().catch((err) => {
      logger.error("queue.redis_error", { err, fallback });
      return fallback;
    });
  } catch {
    return Promise.resolve(fallback);
  }
}

export async function getActiveCount(): Promise<number> {
  return safeRedis(() => redisSubscriber.sCard(ACTIVE_SET), 0);
}

export async function enqueue(
  interviewId: string,
  userId: string,
): Promise<number> {
  return safeRedis(async () => {
    await redisSubscriber.hSet(`${META_PREFIX}${interviewId}`, {
      userId,
      status: "WAITING",
      createdAt: Date.now().toString(),
    });
    await redisSubscriber.expire(`${META_PREFIX}${interviewId}`, 7200);
    await redisSubscriber.zAdd(WAITING_SORTED, {
      score: Date.now(),
      value: interviewId,
    });
    const position = await redisSubscriber.zRank(WAITING_SORTED, interviewId);
    return (position ?? 0) + 1;
  }, 0);
}

export async function activateInQueue(interviewId: string): Promise<void> {
  return safeRedis(
    async () => {
      await redisSubscriber.sAdd(ACTIVE_SET, interviewId);
      await redisSubscriber.hSet(`${META_PREFIX}${interviewId}`, {
        status: "ACTIVE",
        startedAt: Date.now().toString(),
      });
    },
    undefined as unknown as void,
  );
}

export async function tryActivate(interviewId: string): Promise<boolean> {
  return safeRedis(async () => {
    const activeCount = await getActiveCount();
    if (activeCount >= MAX_CONCURRENT) return false;
    await activateInQueue(interviewId);
    return true;
  }, true);
}

export async function releaseSlot(interviewId: string): Promise<void> {
  return safeRedis(
    async () => {
      await redisSubscriber.sRem(ACTIVE_SET, interviewId);
      await redisSubscriber.hSet(`${META_PREFIX}${interviewId}`, {
        status: "COMPLETED",
        endedAt: Date.now().toString(),
      });
    },
    undefined as unknown as void,
  );
}

export async function removeFromQueue(interviewId: string): Promise<void> {
  return safeRedis(
    async () => {
      await redisSubscriber.zRem(WAITING_SORTED, interviewId);
      await redisSubscriber.hSet(`${META_PREFIX}${interviewId}`, {
        status: "CANCELLED",
      });
    },
    undefined as unknown as void,
  );
}

export async function dequeueNext(): Promise<string | null> {
  return safeRedis(async () => {
    const result = await redisSubscriber.zPopMin(WAITING_SORTED);
    if (!result) return null;
    return result.value;
  }, null);
}

export async function getPosition(interviewId: string): Promise<number> {
  return safeRedis(async () => {
    const rank = await redisSubscriber.zRank(WAITING_SORTED, interviewId);
    return rank !== null ? rank + 1 : 0;
  }, 0);
}

export async function getQueueLength(): Promise<number> {
  return safeRedis(() => redisSubscriber.zCard(WAITING_SORTED), 0);
}
