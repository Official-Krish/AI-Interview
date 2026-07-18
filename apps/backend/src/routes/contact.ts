import { Elysia, t } from "elysia";
import { sendContactEmail } from "../lib/email";
import { redisSubscriber } from "../lib/redis";
import { withIdempotency } from "../middleware/idempotency";

const CONTACT_IP_PREFIX = "contact_ip:";
const CONTACT_EMAIL_PREFIX = "contact_email:";
const CONTACT_WINDOW = 3600;

export const contactRoutes = new Elysia({ prefix: "/contact" }).post(
  "/send",
  withIdempotency(async ({ body, set, request }: any) => {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const ipKey = `${CONTACT_IP_PREFIX}${ip}`;
    const emailKey = `${CONTACT_EMAIL_PREFIX}${body.email.toLowerCase().trim()}`;

    const ipCount = await redisSubscriber.get(ipKey);
    if (ipCount && parseInt(ipCount) >= 5) {
      set.status = 429;
      return { error: "Too many messages from this IP. Try again later." };
    }

    const emailCount = await redisSubscriber.get(emailKey);
    if (emailCount && parseInt(emailCount) >= 1) {
      set.status = 429;
      return {
        error:
          "You can only send one message per hour. Please wait before trying again.",
      };
    }

    const sent = await sendContactEmail(
      body.name,
      body.email,
      body.subject,
      body.message,
    );
    if (!sent) {
      set.status = 500;
      return { error: "Failed to send message. Please try again later." };
    }

    await redisSubscriber.incr(ipKey);
    await redisSubscriber.expire(ipKey, CONTACT_WINDOW);
    await redisSubscriber.incr(emailKey);
    await redisSubscriber.expire(emailKey, CONTACT_WINDOW);

    return {
      success: true,
      message: "Message sent. We'll get back to you soon.",
    };
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
