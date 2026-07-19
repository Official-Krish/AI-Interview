import type { PrismaClient } from "@evalio/db";
import { cacheGet, cacheSet } from "../lib/cache";

const CACHE_TTL = 120;

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async getProfile(userId: string) {
    const cacheKey = `user:${userId}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return { user: cached };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        candidate: { select: { githubUsername: true } },
      },
    });

    if (user) {
      await cacheSet(cacheKey, user, CACHE_TTL).catch(() => {});
    }

    return { user };
  }

  async updateName(userId: string, name?: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true },
    });
    return { user: updated };
  }
}
