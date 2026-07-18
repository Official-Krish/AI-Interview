import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";

export const userRoutes = new Elysia({ prefix: "/user" }).guard({}, (app) =>
  app
    .use(authGuard)
    .get("/", async ({ user }) => {
      return container.user.getProfile(user.id);
    })
    .patch(
      "/",
      async ({ user, body }) => {
        return container.user.updateName(user.id, body.name);
      },
      {
        body: t.Object({ name: t.Optional(t.String()) }),
      },
    ),
);
