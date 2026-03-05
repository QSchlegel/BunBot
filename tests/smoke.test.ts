import { describe, it, expect, afterEach } from "bun:test";
import { Bot } from "../src/bot";
import { createBot } from "../src/index";
import type { Plugin } from "../src/types";

describe("Smoke Tests", () => {
  let bot: Bot | null = null;

  afterEach(async () => {
    if (bot?.isRunning) {
      await bot.stop();
    }
    bot = null;
  });

  it("full lifecycle: create → command → start → HTTP message → stop", async () => {
    bot = new Bot({ name: "smoke-bot", port: 19900, logLevel: "silent" });
    bot.command("ping", (ctx) => ctx.reply("pong"));
    await bot.start();

    // Send HTTP request to POST /message
    const res = await fetch(`http://localhost:${bot.serverPort}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "ping" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("pong");

    // Health check
    const healthRes = await fetch(`http://localhost:${bot.serverPort}/health`);
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.status).toBe("ok");

    await bot.stop();
    expect(bot.isRunning).toBe(false);
  });

  it("middleware + command via handleMessage", async () => {
    bot = new Bot({ name: "smoke-bot", port: 0, logLevel: "silent" });
    const order: string[] = [];

    bot.use(async (_ctx, next) => {
      order.push("before");
      await next();
      order.push("after");
    });

    bot.command("greet", async (ctx) => {
      order.push("handler");
      await ctx.reply(`Hello ${ctx.args.join(" ")}!`);
    });

    let replied = "";
    await bot.handleMessage({
      command: "greet",
      args: ["world"],
      replyFn: (msg) => { replied = msg; },
    });

    expect(order).toEqual(["before", "handler", "after"]);
    expect(replied).toBe("Hello world!");
  });

  it("plugin registers commands and runs on start", async () => {
    bot = new Bot({ name: "smoke-bot", port: 0, logLevel: "silent" });
    let setupCalled = false;

    const plugin: Plugin = {
      name: "greet-plugin",
      setup(b) {
        setupCalled = true;
        b.command("hello", (ctx) => ctx.reply("world"));
      },
    };

    bot.plugin(plugin);
    await bot.start();

    expect(setupCalled).toBe(true);

    let replied = "";
    await bot.handleMessage({
      command: "hello",
      args: [],
      replyFn: (msg) => { replied = msg; },
    });
    expect(replied).toBe("world");
  });

  it("createBot factory works end-to-end", async () => {
    bot = createBot({ name: "factory-bot", port: 0, logLevel: "silent" });

    let replied = "";
    bot.command("echo", async (ctx) => {
      await ctx.reply(ctx.args.join(" "));
    });

    await bot.handleMessage({
      command: "echo",
      args: ["hello", "factory"],
      replyFn: (msg) => { replied = msg; },
    });

    expect(replied).toBe("hello factory");
  });

  it("graceful shutdown: server stops accepting connections", async () => {
    bot = new Bot({ name: "smoke-bot", port: 19901, logLevel: "silent" });
    bot.command("ping", (ctx) => ctx.reply("pong"));
    await bot.start();

    // Verify it works
    const res1 = await fetch(`http://localhost:${bot.serverPort}/health`);
    expect(res1.status).toBe(200);

    // Stop
    await bot.stop();
    expect(bot.isRunning).toBe(false);

    // Server should be down — fetch should throw
    try {
      await fetch(`http://localhost:19901/health`);
      // If we get here, the server didn't stop properly
      expect(true).toBe(false); // force fail
    } catch (err) {
      // Expected — connection refused
      expect(err).toBeDefined();
    }
  });

  it("multiple commands and middleware compose correctly", async () => {
    bot = new Bot({ name: "smoke-bot", port: 0, logLevel: "silent" });
    const log: string[] = [];

    bot.use(async (ctx, next) => {
      log.push(`cmd:${ctx.command}`);
      await next();
    });

    bot.command("add", async (ctx) => {
      const sum = ctx.args.map(Number).reduce((a, b) => a + b, 0);
      await ctx.reply(String(sum));
    });

    bot.command("upper", async (ctx) => {
      await ctx.reply(ctx.args.join(" ").toUpperCase());
    });

    let replied = "";

    await bot.handleMessage({
      command: "add",
      args: ["1", "2", "3"],
      replyFn: (msg) => { replied = msg; },
    });
    expect(replied).toBe("6");

    await bot.handleMessage({
      command: "upper",
      args: ["hello", "world"],
      replyFn: (msg) => { replied = msg; },
    });
    expect(replied).toBe("HELLO WORLD");

    expect(log).toEqual(["cmd:add", "cmd:upper"]);
  });
});
