import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { strictRateLimit, authRateLimit } from "../middleware/rateLimit";
import { withIdempotency } from "../middleware/idempotency";
import { container } from "../lib/container";

export const resumeRoutes = new Elysia({ prefix: "/resumes" }).guard(
  {},
  (app) =>
    app
      .use(authGuard)
      .guard({}, (g) =>
        g.use(strictRateLimit).post(
          "/upload",
          withIdempotency(async ({ user, body }: any) => {
            return await container.resume.upload(user.id, user.name, body.file);
          }),
          {
            body: t.Object({
              file: t.File(),
            }),
          },
        ),
      )
      .get("/", async ({ user }: any) => {
        return await container.resume.list(user.id);
      })
      .guard({}, (g) =>
        g
          .use(authRateLimit)
          .get("/:id/url", async ({ params: { id }, user }: any) => {
            return await container.resume.getUrl(id, user.id);
          }),
      ),
);
