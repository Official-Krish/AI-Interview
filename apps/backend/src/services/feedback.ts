import type { PrismaClient } from "@evalio/db";
import { sendFeedbackThankYouEmail } from "../lib/email";

export class FeedbackService {
  constructor(private prisma: PrismaClient) {}

  async submit(
    userId: string,
    userEmail: string,
    userName: string | null,
    body: {
      subject: string;
      rating: number;
      category?: string;
      message: string;
    },
  ) {
    const feedback = await this.prisma.feedback.create({
      data: {
        userId,
        subject: body.subject,
        rating: body.rating,
        category: body.category ?? "General",
        message: body.message,
      },
    });

    try {
      await sendFeedbackThankYouEmail(userEmail, userName ?? "User");
    } catch {
      // non-blocking
    }

    return { feedback };
  }

  async list(userId: string, userRole: string) {
    if (userRole !== "ADMIN") return { feedbacks: [] };

    const feedbacks = await this.prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    });
    return { feedbacks };
  }
}
