import { Elysia } from "elysia";

const DEFAULT_MAX_BYTES = 1_048_576;
const UPLOAD_MAX_BYTES = 10_485_760;

export const bodyLimit = new Elysia({ name: "body-limit" }).onRequest(
  ({ request, set }) => {
    if (request.method === "GET" || request.method === "HEAD") return;

    const url = new URL(request.url);
    const isUpload = url.pathname === "/api/resumes/upload";
    const maxBytes = isUpload ? UPLOAD_MAX_BYTES : DEFAULT_MAX_BYTES;

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > maxBytes) {
      set.status = 413;
      return {
        error: isUpload
          ? "File too large. Maximum size is 10 MB."
          : "Request body too large.",
        code: "PAYLOAD_TOO_LARGE",
      };
    }
  },
);
