import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";

const ProjectSchema = t.Object({
  name: t.String(),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  stars: t.Optional(t.Number()),
  language: t.Optional(t.Union([t.String(), t.Null()])),
});

export const githubRoutes = new Elysia({ prefix: "/github" }).guard({}, (app) =>
  app
    .use(authGuard)
    .get("/", async ({ user }) => {
      return container.github.getProfile(user.id);
    })
    .put(
      "/",
      async ({ user, body }) => {
        return container.github.upsertProfile(user.id, body);
      },
      {
        body: t.Object({
          username: t.String(),
          summary: t.Optional(t.String()),
          languages: t.Optional(t.Array(t.String())),
          projects: t.Optional(t.Array(ProjectSchema)),
        }),
      },
    )
    .delete("/", async ({ user }) => {
      return container.github.deleteProfile(user.id);
    }),
);
