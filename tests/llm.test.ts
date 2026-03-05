import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { createProvider, registerProvider } from "../src/llm/provider";
import { OpenAIProvider } from "../src/llm/openai";
import { AnthropicProvider } from "../src/llm/anthropic";
import { OllamaProvider } from "../src/llm/ollama";

describe("LLM Providers", () => {
  describe("createProvider", () => {
    it("creates an OpenAI provider", () => {
      const provider = createProvider({ provider: "openai", model: "gpt-4o", apiKey: "sk-test" });
      expect(provider.name).toBe("openai");
    });

    it("creates an Anthropic provider", () => {
      const provider = createProvider({ provider: "anthropic", model: "claude-sonnet-4-20250514", apiKey: "sk-test" });
      expect(provider.name).toBe("anthropic");
    });

    it("creates an Ollama provider", () => {
      const provider = createProvider({ provider: "ollama", model: "llama3" });
      expect(provider.name).toBe("ollama");
    });

    it("throws for unknown provider", () => {
      expect(() => createProvider({ provider: "unknown", model: "x" })).toThrow("Unknown LLM provider");
    });

    it("supports custom providers via registerProvider", () => {
      registerProvider("custom", (config) => ({
        name: "custom",
        chat: async () => ({ content: "custom-response", model: config.model, usage: { promptTokens: 0, completionTokens: 0 } }),
      }));

      const provider = createProvider({ provider: "custom", model: "my-model" });
      expect(provider.name).toBe("custom");
    });
  });

  describe("OpenAIProvider", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("sends correct request format", async () => {
      let capturedUrl = "";
      let capturedBody: any = null;

      globalThis.fetch = async (url: any, init: any) => {
        capturedUrl = url.toString();
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({
          choices: [{ message: { content: "Hello!" } }],
          model: "gpt-4o",
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }));
      };

      const provider = new OpenAIProvider({ provider: "openai", model: "gpt-4o", apiKey: "sk-test" });
      const response = await provider.chat([{ role: "user", content: "Hi" }]);

      expect(capturedUrl).toBe("https://api.openai.com/v1/chat/completions");
      expect(capturedBody.model).toBe("gpt-4o");
      expect(capturedBody.messages).toEqual([{ role: "user", content: "Hi" }]);
      expect(response.content).toBe("Hello!");
      expect(response.usage.promptTokens).toBe(10);
      expect(response.usage.completionTokens).toBe(5);
    });

    it("supports custom baseUrl", async () => {
      let capturedUrl = "";

      globalThis.fetch = async (url: any) => {
        capturedUrl = url.toString();
        return new Response(JSON.stringify({
          choices: [{ message: { content: "ok" } }],
          model: "custom",
          usage: { prompt_tokens: 0, completion_tokens: 0 },
        }));
      };

      const provider = new OpenAIProvider({
        provider: "openai",
        model: "custom",
        apiKey: "sk-test",
        baseUrl: "https://my-api.example.com/v1",
      });
      await provider.chat([{ role: "user", content: "test" }]);

      expect(capturedUrl).toBe("https://my-api.example.com/v1/chat/completions");
    });

    it("throws on API error", async () => {
      globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });

      const provider = new OpenAIProvider({ provider: "openai", model: "gpt-4o", apiKey: "bad-key" });
      expect(provider.chat([{ role: "user", content: "test" }])).rejects.toThrow("OpenAI API error (401)");
    });
  });

  describe("AnthropicProvider", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("separates system message from conversation", async () => {
      let capturedBody: any = null;

      globalThis.fetch = async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({
          content: [{ type: "text", text: "I'm Claude" }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 15, output_tokens: 8 },
        }));
      };

      const provider = new AnthropicProvider({ provider: "anthropic", model: "claude-sonnet-4-20250514", apiKey: "sk-test" });
      const response = await provider.chat([
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Who are you?" },
      ]);

      expect(capturedBody.system).toBe("You are helpful");
      expect(capturedBody.messages).toEqual([{ role: "user", content: "Who are you?" }]);
      expect(response.content).toBe("I'm Claude");
      expect(response.usage.promptTokens).toBe(15);
    });
  });

  describe("OllamaProvider", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("sends correct request to Ollama", async () => {
      let capturedUrl = "";
      let capturedBody: any = null;

      globalThis.fetch = async (url: any, init: any) => {
        capturedUrl = url.toString();
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({
          message: { content: "Local model response" },
          model: "llama3",
          prompt_eval_count: 20,
          eval_count: 10,
        }));
      };

      const provider = new OllamaProvider({ provider: "ollama", model: "llama3" });
      const response = await provider.chat([{ role: "user", content: "Hello" }]);

      expect(capturedUrl).toBe("http://localhost:11434/api/chat");
      expect(capturedBody.stream).toBe(false);
      expect(response.content).toBe("Local model response");
      expect(response.usage.promptTokens).toBe(20);
      expect(response.usage.completionTokens).toBe(10);
    });
  });
});
