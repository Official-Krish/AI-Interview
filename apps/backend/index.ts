import { app } from "./src/app";
import { startWsServer } from "./src/ws";
import { initRedis } from "./src/lib/redis";

// ── Global error handlers — prevent process crashes on leaked rejections ──
process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled promise rejection:", reason);
  console.error("[FATAL] Promise:", promise);
});

process.on("uncaughtException", (err, origin) => {
  console.error(`[FATAL] Uncaught exception (${origin}):`, err);
});

async function main() {
  await initRedis();

  const port = parseInt(Bun.env.PORT ?? "3000");

  app.listen({ port }, () => {});

  startWsServer();
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});

export { app };
export type App = typeof app;
