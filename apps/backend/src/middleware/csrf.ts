import { Elysia } from "elysia";

const ALLOWED_ORIGINS = new Set([
  "https://evalio.krishlabs.tech",
  "http://localhost:5173",
  "http://localhost:3000",
]);

export const csrfProtection = new Elysia({ name: "csrf-protection" }).onRequest(
  ({ request, set }) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;

    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    const url = new URL(request.url);
    const path = url.pathname;

    // Skip CSRF for auth endpoints that use cookies (they have their own protections)
    if (
      path.startsWith("/api/auth/refresh") ||
      path.startsWith("/api/auth/logout") ||
      path.startsWith("/api/auth/revoke")
    ) {
      return;
    }

    // If Origin header is present, it must be allowed
    if (origin) {
      const isAllowed = Array.from(ALLOWED_ORIGINS).some(
        (allowed) => origin === allowed || origin.startsWith(allowed + "/"),
      );
      if (!isAllowed) {
        set.status = 403;
        return { error: "CSRF validation failed", code: "CSRF_ORIGIN" };
      }
    }
    // If no Origin (e.g. older browsers), check Referer
    else if (referer) {
      const refererUrl = new URL(referer);
      const isAllowed = Array.from(ALLOWED_ORIGINS).some(
        (allowed) =>
          refererUrl.origin === allowed ||
          refererUrl.origin.startsWith(allowed + "/"),
      );
      if (!isAllowed) {
        set.status = 403;
        return { error: "CSRF validation failed", code: "CSRF_REFERER" };
      }
    }
    // If neither Origin nor Referer is present, allow (browser always sends one for cross-origin)
  },
);
