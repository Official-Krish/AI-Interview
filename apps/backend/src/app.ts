import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysia/jwt";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/user";
import { interviewRoutes } from "./routes/interview";
import { turnRoutes } from "./routes/turn";
import { resumeRoutes } from "./routes/resume";
import { githubRoutes } from "./routes/github";
import { evaluateRoutes } from "./routes/evaluate";
import { companyRoutes } from "./routes/company";
import { profileRoutes } from "./routes/profile";
import { contactRoutes } from "./routes/contact";
import { feedbackRoutes } from "./routes/feedback";
import { dsaRoutes } from "./routes/dsa";
import { sqlRoutes } from "./routes/sql";
import { sdRoutes } from "./routes/sd";
import { canvasRoutes } from "./routes/canvas";
import { quantRoutes } from "./routes/quant";
import { caseStudyRoutes } from "./routes/case-study";
import { discussionRoutes } from "./routes/discussion";
import { analysisRoutes } from "./routes/analysis";
import { globalRateLimit } from "./middleware/rateLimit";

const JWT_SECRET = Bun.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const SITE_URL = "https://evalio.krishlabs.tech";

const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#1a1a1a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c8a97e"/>
      <stop offset="100%" stop-color="#a8885e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="200" r="300" fill="#c8a97e" opacity="0.04"/>
  <circle cx="1100" cy="300" r="200" fill="#c8a97e" opacity="0.03"/>
  <text x="80" y="200" font-family="Georgia, serif" font-size="72" font-weight="bold" fill="#ffffff" letter-spacing="-0.5">Evalio</text>
  <text x="80" y="280" font-family="Georgia, serif" font-size="28" fill="#a8885e" font-style="italic">interview practice that remembers.</text>
  <text x="80" y="360" font-family="system-ui, sans-serif" font-size="18" fill="#888888">
    <tspan x="80" dy="0">Practice interviews with AI that thinks</tspan>
    <tspan x="80" dy="28">like real interviewers. Scored across</tspan>
    <tspan x="80" dy="28">6 dimensions with actionable feedback.</tspan>
  </text>
  <rect x="80" y="440" width="180" height="48" rx="24" fill="url(#accent)"/>
  <text x="170" y="472" font-family="system-ui, sans-serif" font-size="16" fill="#0a0a0a" text-anchor="middle" font-weight="600">Get Started</text>
  <line x1="80" y1="530" x2="400" y2="530" stroke="#c8a97e" stroke-width="1" opacity="0.3"/>
  <text x="80" y="570" font-family="system-ui, sans-serif" font-size="12" fill="#555555">evalio.krishlabs.tech</text>
</svg>`;

const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /interview/
Disallow: /results/
Disallow: /profile/
Disallow: /admin/
Disallow: /feedback/

Sitemap: ${SITE_URL}/sitemap.xml
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><priority>1.0</priority></url>
  <url><loc>${SITE_URL}/pricing</loc><priority>0.8</priority></url>
  <url><loc>${SITE_URL}/about</loc><priority>0.7</priority></url>
  <url><loc>${SITE_URL}/faq</loc><priority>0.7</priority></url>
  <url><loc>${SITE_URL}/contact</loc><priority>0.6</priority></url>
  <url><loc>${SITE_URL}/blog</loc><priority>0.8</priority></url>
  <url><loc>${SITE_URL}/careers</loc><priority>0.6</priority></url>
  <url><loc>${SITE_URL}/docs</loc><priority>0.5</priority></url>
  <url><loc>${SITE_URL}/privacy</loc><priority>0.4</priority></url>
  <url><loc>${SITE_URL}/terms</loc><priority>0.4</priority></url>
  <url><loc>${SITE_URL}/cookies</loc><priority>0.3</priority></url>
  <url><loc>${SITE_URL}/login</loc><priority>0.5</priority></url>
  <url><loc>${SITE_URL}/signup</loc><priority>0.5</priority></url>
</urlset>
`;

export const app = new Elysia()
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .get("/ready", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .get(
    "/robots.txt",
    () =>
      new Response(ROBOTS_TXT, { headers: { "Content-Type": "text/plain" } }),
  )
  .get(
    "/sitemap.xml",
    () =>
      new Response(SITEMAP_XML, {
        headers: { "Content-Type": "application/xml" },
      }),
  )
  .get(
    "/og.png",
    () =>
      new Response(OG_SVG, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      }),
  )
  .use(globalRateLimit)
  .use(
    cors({
      origin: Bun.env.CORS_ORIGIN ?? "https://evalio.krishlabs.tech",
      credentials: true,
    }),
  )
  .use(
    jwt({
      secret: JWT_SECRET,
      exp: "7d",
    }),
  )
  .onError(({ error, set }) => {
    if (error instanceof Error && error.message === "Unauthorized") {
      set.status = 401;
      return {
        error: "You are logged out. Please sign in to continue.",
      };
    }
  })
  .group("/api", (app) =>
    app
      .use(authRoutes)
      .use(userRoutes)
      .use(interviewRoutes)
      .use(turnRoutes)
      .use(resumeRoutes)
      .use(githubRoutes)
      .use(evaluateRoutes)
      .use(companyRoutes)
      .use(profileRoutes)
      .use(contactRoutes)
      .use(feedbackRoutes)
      .use(dsaRoutes)
      .use(sqlRoutes)
      .use(sdRoutes)
      .use(canvasRoutes)
      .use(quantRoutes)
      .use(caseStudyRoutes)
      .use(discussionRoutes)
      .use(analysisRoutes),
  );
