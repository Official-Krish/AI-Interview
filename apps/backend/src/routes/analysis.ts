import { Elysia } from "elysia";
import { authGuard } from "../middleware/auth";
import { container } from "../lib/container";
import { cached } from "../lib/cacheMiddleware";

export const analysisRoutes = new Elysia().guard({}, (app) =>
  app
    .use(authGuard)
    .get(
      "/interview/:id/analysis",
      cached(
        600,
        async ({ params: { id }, user }: any) => {
          return container.analysis.getInterviewAnalysis(user.id, id);
        },
        ({ params: { id }, user }: any) => `analysis:${user.id}:${id}`,
      ),
    )
    .get("/analysis", async ({ user }) => {
      return container.analysis.getAllAnalysis(user.id);
    }),
);
