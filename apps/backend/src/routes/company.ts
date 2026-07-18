import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";

export const companyRoutes = new Elysia({ prefix: "/companies" })
  .use(authGuard)
  .post(
    "/generate",
    async ({ body }) => {
      return container.company.generate(body);
    },
    {
      body: t.Object({
        companyName: t.String(),
        industry: t.Optional(t.String()),
      }),
    },
  );
