import { cacheGet, cacheSet, cacheDel } from "./cache";

const QUESTION_TTL = 30 * 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QuestionEntry = Record<string, any>;

export async function getCachedQuestion<T extends QuestionEntry>(
  cachePrefix: string,
  interviewId: string,
): Promise<T | null> {
  const mapping = await cacheGet<{ key: string }>(
    `cache:q:idx:${cachePrefix}:${interviewId}`,
  );
  if (!mapping) return null;
  const entry = await cacheGet<T>(`cache:q:data:${cachePrefix}:${mapping.key}`);
  return entry ?? null;
}

export async function setCachedQuestion<T extends QuestionEntry>(
  cachePrefix: string,
  interviewId: string,
  key: string,
  entry: T,
): Promise<void> {
  await Promise.all([
    cacheSet(`cache:q:data:${cachePrefix}:${key}`, entry, QUESTION_TTL),
    cacheSet(
      `cache:q:idx:${cachePrefix}:${interviewId}`,
      { key },
      QUESTION_TTL,
    ),
  ]);
}

export async function clearCachedQuestion(
  cachePrefix: string,
  interviewId: string,
): Promise<void> {
  const mapping = await cacheGet<{ key: string }>(
    `cache:q:idx:${cachePrefix}:${interviewId}`,
  );
  if (mapping) {
    await cacheDel(`cache:q:data:${cachePrefix}:${mapping.key}`);
  }
  await cacheDel(`cache:q:idx:${cachePrefix}:${interviewId}`);
}
