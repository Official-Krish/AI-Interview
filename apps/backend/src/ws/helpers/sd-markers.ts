import type { CanvasDiffAction } from "@evalio/shared";
import type { InterviewConnection } from "../session";

export function resetSdCounters(conn: InterviewConnection) {
  conn.canvasDiffCount = 0;
  conn.canvasExampleCount = 0;
  conn.lastCanvasDiffTime = 0;
  conn.lastCanvasExampleTime = 0;
}

export async function handleSdMarkers(conn: InterviewConnection) {
  const buf = conn.questionBuf;

  const diffMatch = buf.match(
    /<canvas_diff>\s*(\[[\s\S]*?\])\s*<\/canvas_diff>/i,
  );
  if (diffMatch) {
    const now = Date.now();
    const canSend =
      now - conn.lastCanvasDiffTime >= 15_000 && conn.canvasDiffCount < 50;
    if (canSend) {
      try {
        const actions = JSON.parse(diffMatch[1]!) as CanvasDiffAction[];
        await conn.safeSend({ type: "canvas_diff", actions });
        conn.canvasDiffCount++;
        conn.lastCanvasDiffTime = now;
      } catch {
        /* invalid JSON */
      }
    }
  }

  const exampleMatch = buf.match(
    /<canvas_example>\s*(\{[\s\S]*?\})\s*<\/canvas_example>/i,
  );
  if (exampleMatch) {
    const now = Date.now();
    const canSend =
      now - conn.lastCanvasExampleTime >= 60_000 && conn.canvasExampleCount < 5;
    if (canSend) {
      try {
        const payload = JSON.parse(exampleMatch[1]!);
        await conn.safeSend({ type: "canvas_example", ...payload });
        conn.canvasExampleCount++;
        conn.lastCanvasExampleTime = now;
      } catch {
        /* invalid JSON */
      }
    }
  }
}
