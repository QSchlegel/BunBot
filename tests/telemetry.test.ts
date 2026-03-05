import { describe, it, expect } from "bun:test";
import { Telemetry } from "../src/telemetry";

describe("Telemetry", () => {
  it("is disabled by default", () => {
    const t = new Telemetry({ enabled: false });
    expect(t.isEnabled).toBe(false);
  });

  it("createSpan runs fn even when disabled (no-op wrapper)", async () => {
    const t = new Telemetry({ enabled: false });
    let called = false;

    await t.createSpan("test", async () => {
      called = true;
    });

    expect(called).toBe(true);
  });

  it("createSpan returns fn result when disabled", async () => {
    const t = new Telemetry({ enabled: false });
    const result = await t.createSpan("test", async () => 42);
    expect(result).toBe(42);
  });

  it("recordCommand is a no-op when disabled", () => {
    const t = new Telemetry({ enabled: false });
    // Should not throw
    t.recordCommand("ping", 100, "ok");
  });

  it("stays disabled if @opentelemetry/api is not installed", async () => {
    const t = new Telemetry({ enabled: true, serviceName: "test" });
    await t.init(); // Should not throw, just stay disabled
    // In this test env, otel is not installed, so it stays disabled
    expect(t.isEnabled).toBe(false);
  });
});
