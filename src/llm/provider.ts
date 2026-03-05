import type { LLMProvider, LLMProviderConfig, LLMProviderFactory } from "./types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { OllamaProvider } from "./ollama";

const registry = new Map<string, LLMProviderFactory>();

// Register built-in providers
registry.set("openai", (config) => new OpenAIProvider(config));
registry.set("anthropic", (config) => new AnthropicProvider(config));
registry.set("ollama", (config) => new OllamaProvider(config));

export function registerProvider(name: string, factory: LLMProviderFactory): void {
  registry.set(name, factory);
}

export function createProvider(config: LLMProviderConfig): LLMProvider {
  const factory = registry.get(config.provider);
  if (!factory) {
    throw new Error(
      `Unknown LLM provider: "${config.provider}". ` +
        `Available: ${[...registry.keys()].join(", ")}. ` +
        `Use registerProvider() to add custom providers.`,
    );
  }
  return factory(config);
}
