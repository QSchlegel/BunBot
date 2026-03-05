import type { Bot } from "./bot";

// ---- Log levels ----
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

// ---- LLM Config ----
export interface LLMConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

// ---- Langfuse Config ----
export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
  enabled?: boolean;
}

// ---- Telemetry Config ----
export interface TelemetryConfig {
  enabled?: boolean;
  serviceName?: string;
}

// ---- Bot Config ----
export interface BotConfig {
  name: string;
  port?: number;
  healthPath?: string;
  logLevel?: LogLevel;
  env?: Record<string, string>;
  llm?: LLMConfig;
  langfuse?: LangfuseConfig;
  telemetry?: TelemetryConfig;
}

export interface ResolvedBotConfig {
  name: string;
  port: number;
  healthPath: string;
  logLevel: LogLevel;
  env: Record<string, string>;
  llm: LLMConfig | null;
  langfuse: LangfuseConfig | null;
  telemetry: TelemetryConfig;
}

// ---- Context ----
export type ReplyFn = (message: string) => void | Promise<void>;

// ---- Handlers ----
export type CommandHandler = (ctx: import("./context").Context) => void | Promise<void>;
export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;
export type Middleware = (
  ctx: import("./context").Context,
  next: () => Promise<void>,
) => void | Promise<void>;

// ---- Plugin ----
export interface Plugin {
  name: string;
  setup: (bot: Bot) => void | Promise<void>;
}
