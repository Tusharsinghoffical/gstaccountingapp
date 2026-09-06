export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: string;
  stack?: string;
}

function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const sanitized: Record<string, unknown> = {};
  const REDACTED_KEYS = ["password", "token", "secret", "authorization", "apikey", "key"];

  for (const [k, v] of Object.entries(context)) {
    if (REDACTED_KEYS.some((rk) => k.toLowerCase().includes(rk))) {
      sanitized[k] = "[REDACTED]";
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function log(level: LogLevel, message: string, err?: unknown, context?: Record<string, unknown>) {
  const isProduction = process.env.NODE_ENV === "production";
  const timestamp = new Date().toISOString();

  let errorStr: string | undefined;
  let stackStr: string | undefined;

  if (err instanceof Error) {
    errorStr = err.message;
    stackStr = err.stack;
  } else if (err) {
    errorStr = String(err);
  }

  const payload: LogPayload = {
    timestamp,
    level,
    message,
    context: sanitizeContext(context),
    ...(errorStr ? { error: errorStr } : {}),
    ...(stackStr && !isProduction ? { stack: stackStr } : {}),
  };

  if (isProduction) {
    // Structured JSON log output for cloud log ingestion (Datadog, Render, CloudWatch)
    const jsonOutput = JSON.stringify(payload);
    if (level === "error") {
      process.stderr.write(jsonOutput + "\n");
    } else {
      process.stdout.write(jsonOutput + "\n");
    }
  } else {
    // Human readable output in development
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    if (level === "error") {
      console.error(`${prefix} ${message}`, err || "", context || "");
    } else if (level === "warn") {
      console.warn(`${prefix} ${message}`, err || "", context || "");
    } else {
      console.log(`${prefix} ${message}`, context || "");
    }
  }
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    log("info", message, undefined, context);
  },
  warn(message: string, error?: unknown, context?: Record<string, unknown>) {
    log("warn", message, error, context);
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    log("error", message, error, context);
  },
  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      log("debug", message, undefined, context);
    }
  },
};

export default logger;
