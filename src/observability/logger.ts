import type { MarketEventType } from "./events";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

// Structured logger. In alpha this writes JSON lines to stdout; the shape is
// designed so a real sink (Datadog, Loki, etc.) can ingest it unchanged.
// AI outputs and validation failures are logged here — but never raw prompts
// or secrets (see redact()).
class Logger {
  private base: LogContext;

  constructor(base: LogContext = {}) {
    this.base = base;
  }

  child(context: LogContext): Logger {
    return new Logger({ ...this.base, ...context });
  }

  private emit(level: LogLevel, message: string, context?: LogContext): void {
    const record = {
      level,
      message,
      time: new Date().toISOString(),
      ...this.base,
      ...redact(context ?? {}),
    };
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "production") return;
    this.emit("debug", message, context);
  }
  info(message: string, context?: LogContext): void {
    this.emit("info", message, context);
  }
  warn(message: string, context?: LogContext): void {
    this.emit("warn", message, context);
  }
  error(message: string, context?: LogContext): void {
    this.emit("error", message, context);
  }

  /** Log a canonical market event. Pairs with MarketTraceService persistence. */
  event(eventType: MarketEventType, context?: LogContext): void {
    this.emit("info", `event:${eventType}`, { event: eventType, ...context });
  }
}

const SENSITIVE_KEYS = new Set([
  "prompt",
  "systemPrompt",
  "apiKey",
  "authorization",
  "password",
  "token",
]);

/** Strip keys that must never reach logs (raw prompts, secrets). */
function redact(context: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = SENSITIVE_KEYS.has(key) ? "[redacted]" : value;
  }
  return out;
}

export const logger = new Logger({ service: "intentive" });
