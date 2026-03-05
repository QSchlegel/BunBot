import type { LLMProvider, ChatMessage, ChatOptions, ChatResponse } from "./llm/types";
import type { LangfuseConfig } from "./types";

/**
 * Wraps an LLMProvider with Langfuse observability.
 * When Langfuse is not installed or disabled, returns the provider as-is (zero overhead).
 */
export class LangfuseIntegration {
  private client: any = null;
  private enabled = false;

  constructor(private config: LangfuseConfig) {
    this.enabled = config.enabled !== false;
  }

  async init(): Promise<void> {
    if (!this.enabled) return;

    try {
      // @ts-ignore - langfuse is an optional peer dependency
      const langfuse = await import("langfuse");
      this.client = new langfuse.Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        ...(this.config.baseUrl && { baseUrl: this.config.baseUrl }),
      });
    } catch {
      // langfuse not installed — stay disabled
      this.enabled = false;
    }
  }

  wrapProvider(provider: LLMProvider): LLMProvider {
    if (!this.enabled || !this.client) return provider;

    const client = this.client;
    const originalChat = provider.chat.bind(provider);

    return {
      name: provider.name,
      async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
        const trace = client.trace({
          name: `llm.${provider.name}.chat`,
          metadata: { provider: provider.name },
        });

        const generation = trace.generation({
          name: "chat",
          model: options?.model ?? "default",
          input: messages,
          modelParameters: {
            ...(options?.temperature != null && { temperature: options.temperature }),
            ...(options?.maxTokens != null && { maxTokens: options.maxTokens }),
          },
        });

        const startTime = Date.now();

        try {
          const response = await originalChat(messages, options);

          generation.end({
            output: response.content,
            model: response.model,
            usage: {
              input: response.usage.promptTokens,
              output: response.usage.completionTokens,
            },
            metadata: {
              latencyMs: Date.now() - startTime,
            },
          });

          return response;
        } catch (error) {
          generation.end({
            statusMessage: error instanceof Error ? error.message : String(error),
            level: "ERROR",
            metadata: {
              latencyMs: Date.now() - startTime,
            },
          });
          throw error;
        }
      },
    };
  }

  traceCommand(command: string): { end: () => void } {
    if (!this.enabled || !this.client) {
      return { end: () => {} };
    }

    const trace = this.client.trace({
      name: `command.${command}`,
      metadata: { command },
    });

    return {
      end: () => {
        trace.update({ metadata: { command, completed: true } });
      },
    };
  }

  async flush(): Promise<void> {
    if (this.client) {
      await this.client.flushAsync();
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}
