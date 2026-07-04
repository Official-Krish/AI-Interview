import { WebSocketServer, WebSocket as WsWebSocket } from "ws";
import { redisSubscriber } from "../lib/redis";
import { dequeueNext, activateInQueue } from "../lib/queue";
import { InterviewConnection } from "./session";

const WS_PORT = parseInt(Bun.env.WS_PORT ?? "8080");
const CORS_ORIGIN = Bun.env.CORS_ORIGIN ?? "http://localhost:5173";

function getOrigin(request: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const origin = request.headers["origin"];
  if (Array.isArray(origin)) return origin[0] ?? null;
  return origin ?? null;
}

export function startWsServer() {
  const wss = new WebSocketServer({
    port: WS_PORT,
    maxPayload: 1024 * 1024,
    verifyClient: (info, cb) => {
      const origin = getOrigin(info.req);
      if (origin && !origin.startsWith(CORS_ORIGIN.replace(/\/$/, ""))) {
        cb(false, 403, "Origin not allowed");
        return;
      }
      cb(true);
    },
  });
  const wsMap = new Map<string, WsWebSocket>();
  const startCallbacks = new Map<string, () => Promise<void>>();
  const cleaningSet = new Set<string>();

  async function notifyPositionUpdates() {
    const entries = await redisSubscriber.zRange("queue:waiting", 0, -1);
    for (let i = 0; i < entries.length; i++) {
      const ws = wsMap.get(entries[i]!);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "position_update", position: i + 1 }));
      }
    }
  }

  async function dequeueNextAndNotify() {
    while (true) {
      const nextId = await dequeueNext();
      if (!nextId) return;

      const ws = wsMap.get(nextId);
      if (!ws || ws.readyState !== 1) {
        wsMap.delete(nextId);
        startCallbacks.delete(nextId);
        continue;
      }

      await activateInQueue(nextId);

      const callback = startCallbacks.get(nextId);
      if (callback) {
        await callback();
      }
      return;
    }
  }

  wss.on("connection", (client) => {
    console.log("[ws] candidate connected");

    new InterviewConnection(
      client,
      wsMap,
      startCallbacks,
      cleaningSet,
      dequeueNextAndNotify,
      notifyPositionUpdates,
    );
  });

  console.log(`WS server running on port ${WS_PORT}`);
}
