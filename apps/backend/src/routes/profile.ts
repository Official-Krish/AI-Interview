import { Elysia } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { cached } from "../lib/cacheMiddleware";

export const profileRoutes = new Elysia({ prefix: "/profile" }).guard(
  {},
  (app) =>
    app.use(authGuard).get(
      "/skills",
      cached(
        300,
        async ({ user }: any) => {
          return container.profile.getSkills(user.id);
        },
        ({ user }: any) => `profile:skills:${user.id}`,
      ),
    ),
);
