import { Elysia } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { cached } from "../lib/cacheMiddleware";

export const profileRoutes = new Elysia({ prefix: "/profile" }).guard(
  {},
  (app) =>
    app.use(authGuard).get(
      "/skills",
      cached(
        300,
        async ({ user }: any) => {
          const profile = await prisma.candidateSkillProfile.findUnique({
            where: { userId: user.id },
          });
          return { profile };
        },
        ({ user }: any) => `profile:skills:${user.id}`,
      ),
    ),
);
