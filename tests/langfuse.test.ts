import { describe, it, expect } from "bun:test";
import { LangfuseIntegration } from "../src/langfuse";
import type { LLMProvider } from "../src/llm/types";

describe("LangfuseIntegration", () => {
  const mockProvider: LLMProvider = {
    name: "mock",
    async chat() {
      return { content: "mock response", model: "mock-model", usage: { promptTokens: 5, completionTokens: 3 } };
    },
  };

  it("is disabled when enabled=false", () => {
    const lf = new LangfuseIntegration({ publicKey: "pk", secretKey: "sk", enabled: false });
    expect(lf.isEnabled).toBe(false);
  });

  it("wrapProvider returns original provider when disabled", () => {
    const lf = new LangfuseIntegration({ publicKey: "pk", secretKey: "sk", enabled: false });
    const wrapped = lf.wrapProvider(mockProvider);
    expect(wrapped).toBe(mockProvider);
  });

  it("traceCommand returns no-op when disabled", () => {
    const lf = new LangfuseIntegration({ publicKey: "pk", secretKey: "sk", enabled: false });
    const trace = lf.traceCommand("test");
    expect(trace).toHaveProperty("end");
    trace.end(); // should not throw
  });

  it("flush does not throw when disabled", async () => {
    const lf = new LangfuseIntegration({ publicKey: "pk", secretKey: "sk", enabled: false });
    await lf.flush(); // should not throw
  });

  it("stays disabled if langfuse package is not installed", async () => {
    const lf = new LangfuseIntegration({ publicKey: "pk", secretKey: "sk", enabled: true });
    await lf.init(); // Should not throw
    expect(lf.isEnabled).toBe(false); // langfuse not installed
  });

  it("wrapProvider still works correctly after failed init", async () => {
    const lf = new LangfuseIntegration({ publicKey: "pk", secretKey: "sk", enabled: true });
    await lf.init();

    const wrapped = lf.wrapProvider(mockProvider);
    // Should return the original since langfuse is not installed
    expect(wrapped).toBe(mockProvider);

    // Provider should still work
    const response = await wrapped.chat([{ role: "user", content: "test" }]);
    expect(response.content).toBe("mock response");
  });
});
