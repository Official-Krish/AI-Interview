import { Elysia } from "elysia";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https://cdn.krishlabs.tech data: blob:",
  "connect-src 'self' https://api.evalio.krishlabs.tech wss://ws.evalio.krishlabs.tech http://localhost:* ws://localhost:*",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
];

export const securityHeaders = new Elysia({
  name: "security-headers",
}).onAfterHandle(({ set }) => {
  set.headers ??= {};
  set.headers["X-Content-Type-Options"] = "nosniff";
  set.headers["X-Frame-Options"] = "DENY";
  set.headers["Strict-Transport-Security"] =
    "max-age=31536000; includeSubDomains";
  set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  set.headers["X-XSS-Protection"] = "0";
  set.headers["Permissions-Policy"] =
    "camera=(self), microphone=(self), geolocation=()";
  set.headers["Content-Security-Policy"] = CSP_DIRECTIVES.join("; ");
});
