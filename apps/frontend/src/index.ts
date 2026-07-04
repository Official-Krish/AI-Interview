import { serve } from "bun";
import index from "./index.html";

const BACKEND_URL = process.env.VITE_BACKEND_URL || "http://localhost:3000";

serve({
  port: 5173,
  routes: {
    "/api/*": async (req) => {
      const url = new URL(req.url);
      return fetch(`${BACKEND_URL}${url.pathname}${url.search}`, req);
    },
    "/excalidraw.css": () => new Response(Bun.file("public/excalidraw.css")),
    "/audio-processors/capture.worklet.js": () =>
      new Response(Bun.file("public/audio-processors/capture.worklet.js"), {
        headers: { "Content-Type": "application/javascript" },
      }),
    "/audio-processors/playback.worklet.js": () =>
      new Response(Bun.file("public/audio-processors/playback.worklet.js"), {
        headers: { "Content-Type": "application/javascript" },
      }),
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});
