export { Bot } from "./bot";
export { Context } from "./context";
export { Logger } from "./logger";
export { Telemetry } from "./telemetry";
export { LangfuseIntegration } from "./langfuse";
export { resolveConfig } from "./config";

// LLM exports
export {
  createProvider,
  registerProvider,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
} from "./llm";
export type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  LLMProvider,
  LLMProviderConfig,
  LLMProviderFactory,
} from "./llm";

// Type exports
export type {
  BotConfig,
  ResolvedBotConfig,
  CommandHandler,
  EventHandler,
  Middleware,
  Plugin,
  LLMConfig,
  LangfuseConfig,
  TelemetryConfig,
  LogLevel,
  ReplyFn,
} from "./types";

// Convenience factory
import { Bot as _Bot } from "./bot";
import type { BotConfig as _BotConfig } from "./types";

export function createBot(config: Partial<_BotConfig>): _Bot {
  return new _Bot(config);
}
