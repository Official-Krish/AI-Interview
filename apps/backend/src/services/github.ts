import type { PrismaClient } from "@evalio/db";

export class GithubService {
  constructor(private prisma: PrismaClient) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.githubProfile.findUnique({
      where: { userId },
    });
    return { profile };
  }

  async upsertProfile(
    userId: string,
    body: {
      username: string;
      summary?: string;
      languages?: string[];
      projects?: {
        name: string;
        description?: string | null;
        stars?: number;
        language?: string | null;
      }[];
    },
  ) {
    const profile = await this.prisma.githubProfile.upsert({
      where: { userId },
      create: {
        userId,
        username: body.username,
        summary: body.summary ?? "",
        languages: body.languages ?? [],
        projects: body.projects as any,
      },
      update: {
        username: body.username,
        ...(body.summary !== undefined && { summary: body.summary }),
        ...(body.languages !== undefined && { languages: body.languages }),
        ...(body.projects !== undefined && { projects: body.projects as any }),
      },
    });

    await this.prisma.candidateProfile.update({
      where: { userId },
      data: { githubUsername: body.username },
    });

    return { profile };
  }

  async deleteProfile(userId: string) {
    await this.prisma.githubProfile.deleteMany({ where: { userId } });
    await this.prisma.candidateProfile.update({
      where: { userId },
      data: { githubUsername: null },
    });
    return { success: true as const };
  }
}
