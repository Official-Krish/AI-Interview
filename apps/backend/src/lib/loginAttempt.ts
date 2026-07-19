import { redisSubscriber } from "./redis";

const ATTEMPT_PREFIX = "login_attempt:";
const LOCK_PREFIX = "login_lock:";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60;
const WINDOW_DURATION = 15 * 60;

export async function recordFailedAttempt(email: string): Promise<void> {
  const key = `${ATTEMPT_PREFIX}${email.toLowerCase().trim()}`;
  const attempts = await redisSubscriber.incr(key);
  if (attempts === 1) {
    await redisSubscriber.expire(key, WINDOW_DURATION);
  }
  if (attempts >= MAX_ATTEMPTS) {
    const lockKey = `${LOCK_PREFIX}${email.toLowerCase().trim()}`;
    await redisSubscriber.setEx(lockKey, LOCKOUT_DURATION, "1");
  }
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const lockKey = `${LOCK_PREFIX}${email.toLowerCase().trim()}`;
  const locked = await redisSubscriber.get(lockKey);
  return locked !== null;
}

export async function getLockoutRemaining(email: string): Promise<number> {
  const lockKey = `${LOCK_PREFIX}${email.toLowerCase().trim()}`;
  return redisSubscriber.ttl(lockKey);
}

export async function clearFailedAttempts(email: string): Promise<void> {
  const key = `${ATTEMPT_PREFIX}${email.toLowerCase().trim()}`;
  const lockKey = `${LOCK_PREFIX}${email.toLowerCase().trim()}`;
  await Promise.all([redisSubscriber.del(key), redisSubscriber.del(lockKey)]);
}
