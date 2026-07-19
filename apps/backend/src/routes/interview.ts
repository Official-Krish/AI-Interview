import { Elysia, t } from "elysia";
import { authGuard } from "../middleware/auth";
import { generateResumeUrl } from "../lib/s3";
import { strictRateLimit } from "../middleware/rateLimit";
import { cached } from "../lib/cacheMiddleware";
import { withIdempotency } from "../middleware/idempotency";
import { container } from "../lib/container";

export const interviewRoutes = new Elysia({ prefix: "/interview" }).guard(
  {},
  (app) =>
    app
      .use(authGuard)
      .guard({}, (g) =>
        g.use(strictRateLimit).post(
          "/create",
          withIdempotency(async ({ user, body }: any) => {
            return await container.interview.create(user.id, user.role, {
              position: body.position,
              resumeId: body.resumeId,
              githubUrl: body.githubUrl,
              jobDescription: body.jobDescription,
              companyId: body.companyId,
              companyName: body.companyName,
              roleTitle: body.roleTitle,
              roleCategory: body.roleCategory,
              interviewRound: body.interviewRound,
              interviewStyle: body.interviewStyle,
              interviewDepth: body.interviewDepth,
              mode: body.mode,
            });
          }),
          {
            body: t.Object({
              position: t.Optional(t.String()),
              resumeId: t.Optional(t.String()),
              githubUrl: t.Optional(t.String()),
              jobDescription: t.Optional(t.String()),
              companyId: t.Optional(t.String()),
              companyName: t.Optional(t.String()),
              roleTitle: t.Optional(t.String()),
              roleCategory: t.Optional(t.String()),
              interviewRound: t.Optional(t.String()),
              interviewStyle: t.Optional(
                t.Enum({
                  SUPPORTIVE: "SUPPORTIVE",
                  PROFESSIONAL: "PROFESSIONAL",
                  CHALLENGING: "CHALLENGING",
                  BAR_RAISER: "BAR_RAISER",
                }),
              ),
              interviewDepth: t.Optional(
                t.Enum({
                  STANDARD: "STANDARD",
                  PROBING: "PROBING",
                  CHALLENGE: "CHALLENGE",
                  BAR_RAISER: "BAR_RAISER",
                }),
              ),
              mode: t.Optional(
                t.Enum({
                  VOICE: "VOICE",
                  DSA: "LIVE_CODE",
                  SYSTEM_DESIGN: "LIVE_CANVAS",
                  DISCUSSION: "DISCUSSION",
                }),
              ),
              language: t.Optional(t.String()),
            }),
          },
        ),
      )
      .get(
        "/",
        cached(
          60,
          async ({ user, query }: any) => {
            return await container.interview.list(
              user.id,
              query.cursor,
              Number(query.take) || 20,
              Number(query.skip) || 0,
            );
          },
          ({ user, query }: any) =>
            `interviews:${user.id}:${query.cursor ?? query.skip ?? "0"}:${query.take ?? "20"}`,
        ),
      )
      .get("/:id", async ({ params: { id }, user }: any) => {
        return await container.interview.get(id, user.id, generateResumeUrl);
      })
      .patch(
        "/:id",
        async ({ params: { id }, user, body }: any) => {
          return await container.interview.update(id, user.id, {
            status: body.status,
            startedAt: body.startedAt,
            endedAt: body.endedAt,
            durationSeconds: body.durationSeconds,
          });
        },
        {
          body: t.Object({
            status: t.Optional(
              t.Enum({
                CREATED: "CREATED",
                ACTIVE: "ACTIVE",
                COMPLETED: "COMPLETED",
                FAILED: "FAILED",
                CANCELLED: "CANCELLED",
              }),
            ),
            startedAt: t.Optional(t.Nullable(t.Date())),
            endedAt: t.Optional(t.Nullable(t.Date())),
            durationSeconds: t.Optional(t.Nullable(t.Number())),
          }),
        },
      ),
);
