import { sendContactEmail } from "../lib/email";
import { redisSubscriber } from "../lib/redis";
import { AppError } from "../lib/errors";

const CONTACT_IP_PREFIX = "contact_ip:";
const CONTACT_EMAIL_PREFIX = "contact_email:";
const CONTACT_WINDOW = 3600;

export class ContactService {
  async send(
    body: {
      name: string;
      email: string;
      subject: string;
      message: string;
    },
    ip: string,
  ) {
    const ipKey = `${CONTACT_IP_PREFIX}${ip}`;
    const emailKey = `${CONTACT_EMAIL_PREFIX}${body.email.toLowerCase().trim()}`;

    const ipCount = await redisSubscriber.get(ipKey);
    if (ipCount && parseInt(ipCount) >= 5)
      throw new AppError(
        "Too many messages from this IP. Try again later.",
        429,
      );

    const emailCount = await redisSubscriber.get(emailKey);
    if (emailCount && parseInt(emailCount) >= 1)
      throw new AppError(
        "You can only send one message per hour. Please wait before trying again.",
        429,
      );

    const sent = await sendContactEmail(
      body.name,
      body.email,
      body.subject,
      body.message,
    );
    if (!sent)
      throw new AppError(
        "Failed to send message. Please try again later.",
        500,
      );

    await redisSubscriber.incr(ipKey);
    await redisSubscriber.expire(ipKey, CONTACT_WINDOW);
    await redisSubscriber.incr(emailKey);
    await redisSubscriber.expire(emailKey, CONTACT_WINDOW);

    return {
      success: true,
      message: "Message sent. We'll get back to you soon.",
    };
  }
}
