import { Elysia, t } from "elysia";
import { container } from "../lib/container";
import { withIdempotency } from "../middleware/idempotency";

export const contactRoutes = new Elysia({ prefix: "/contact" }).post(
  "/send",
  withIdempotency(async ({ body, request }: any) => {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    return container.contact.send(body, ip);
  }),
  {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      email: t.String({ format: "email" }),
      subject: t.String({ minLength: 1 }),
      message: t.String({ minLength: 1 }),
    }),
  },
);
