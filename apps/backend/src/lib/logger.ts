type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  [key: string]: unknown;
}

function write(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  switch (entry.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  info(
    message: string,
    meta?: {
      requestId?: string;
      userId?: string;
      duration?: number;
      [key: string]: unknown;
    },
  ) {
    write({
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  },

  warn(
    message: string,
    meta?: { requestId?: string; userId?: string; [key: string]: unknown },
  ) {
    write({
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  },

  error(
    message: string,
    meta?: {
      requestId?: string;
      userId?: string;
      err?: unknown;
      [key: string]: unknown;
    },
  ) {
    const errMeta =
      meta?.err instanceof Error
        ? {
            errMessage: (meta.err as Error).message,
            errStack: (meta.err as Error).stack,
          }
        : {};
    write({
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
      ...errMeta,
    });
  },

  debug(
    message: string,
    meta?: { requestId?: string; [key: string]: unknown },
  ) {
    write({
      level: "debug",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  },
};
