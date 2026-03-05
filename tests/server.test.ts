import { describe, it, expect, afterEach } from "bun:test";
import { HealthServer } from "../src/server";

describe("HealthServer", () => {
  let server: HealthServer | null = null;

  afterEach(() => {
    server?.stop();
    server = null;
  });

  it("does not start when port is 0", () => {
    server = new HealthServer({ port: 0, healthPath: "/health" });
    server.start();
    expect(server.isRunning).toBe(false);
  });

  it("starts and serves health endpoint", async () => {
    server = new HealthServer({ port: 0, healthPath: "/health" });
    // Use a random port by setting port > 0
    server = new HealthServer({ port: 19876, healthPath: "/health" });
    server.start();
    expect(server.isRunning).toBe(true);

    const res = await fetch(`http://localhost:${server.port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  it("handles POST /message", async () => {
    server = new HealthServer({ port: 19877, healthPath: "/health" });
    server.start(async (body) => {
      if (body.command === "ping") return "pong";
      return null;
    });

    const res = await fetch(`http://localhost:${server.port}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "ping" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("pong");
  });

  it("returns 400 for missing command field", async () => {
    server = new HealthServer({ port: 19878, healthPath: "/health" });
    server.start(async () => null);

    const res = await fetch(`http://localhost:${server.port}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown routes", async () => {
    server = new HealthServer({ port: 19879, healthPath: "/health" });
    server.start();

    const res = await fetch(`http://localhost:${server.port}/unknown`);
    expect(res.status).toBe(404);
  });

  it("stops cleanly", () => {
    server = new HealthServer({ port: 19880, healthPath: "/health" });
    server.start();
    expect(server.isRunning).toBe(true);

    server.stop();
    expect(server.isRunning).toBe(false);
  });
});
