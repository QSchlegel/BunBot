import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { resolveConfig } from "../src/config";

describe("resolveConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("BUNBOT_")) {
        delete process.env[key];
      }
    }
  });

  it("returns defaults when no config provided", () => {
    const config = resolveConfig({});
    expect(config.name).toBe("bunbot");
    expect(config.port).toBe(3000);
    expect(config.healthPath).toBe("/health");
    expect(config.logLevel).toBe("info");
    expect(config.llm).toBeNull();
    expect(config.langfuse).toBeNull();
    expect(config.telemetry.enabled).toBe(false);
  });

  it("uses explicit config values", () => {
    const config = resolveConfig({
      name: "my-bot",
      port: 8080,
      healthPath: "/healthz",
      logLevel: "debug",
    });
    expect(config.name).toBe("my-bot");
    expect(config.port).toBe(8080);
    expect(config.healthPath).toBe("/healthz");
    expect(config.logLevel).toBe("debug");
  });

  it("reads env vars when no explicit config", () => {
    process.env.BUNBOT_NAME = "env-bot";
    process.env.BUNBOT_PORT = "9090";
    process.env.BUNBOT_LOG_LEVEL = "warn";
    process.env.BUNBOT_HEALTH_PATH = "/status";

    const config = resolveConfig({});
    expect(config.name).toBe("env-bot");
    expect(config.port).toBe(9090);
    expect(config.logLevel).toBe("warn");
    expect(config.healthPath).toBe("/status");
  });

  it("explicit config overrides env vars", () => {
    process.env.BUNBOT_NAME = "env-bot";
    const config = resolveConfig({ name: "explicit-bot" });
    expect(config.name).toBe("explicit-bot");
  });

  it("passes through llm config", () => {
    const config = resolveConfig({
      llm: { provider: "openai", model: "gpt-4o", apiKey: "sk-test" },
    });
    expect(config.llm).toEqual({
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-test",
    });
  });

  it("passes through langfuse config", () => {
    const config = resolveConfig({
      langfuse: { publicKey: "pk", secretKey: "sk" },
    });
    expect(config.langfuse).toEqual({ publicKey: "pk", secretKey: "sk" });
  });

  it("uses bot name as default telemetry service name", () => {
    const config = resolveConfig({ name: "my-bot" });
    expect(config.telemetry.serviceName).toBe("my-bot");
  });
});
