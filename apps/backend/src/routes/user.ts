import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { cached } from "../lib/cacheMiddleware";

export const userRoutes = new Elysia({ prefix: "/user" }).guard({}, (app) =>
  app
    .use(authGuard)
    .get(
      "/",
      cached(
        120,
        async ({ user }: any) => {
          const profile = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
              candidate: {
                select: {
                  githubUsername: true,
                },
              },
            },
          });
          return { user: profile };
        },
        ({ user }: any) => `user:${user.id}`,
      ),
    )
    .patch(
      "/",
      async ({ user, body }) => {
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { name: body.name },
          select: { id: true, email: true, name: true },
        });
        return { user: updated };
      },
      {
        body: t.Object({
          name: t.Optional(t.String()),
        }),
      },
    ),
);
