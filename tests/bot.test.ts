import { describe, it, expect, afterEach } from "bun:test";
import { Bot } from "../src/bot";
import type { Plugin } from "../src/types";

describe("Bot", () => {
  let bot: Bot | null = null;

  afterEach(async () => {
    if (bot?.isRunning) {
      await bot.stop();
    }
    bot = null;
  });

  it("creates a bot with default config", () => {
    bot = new Bot({ name: "test-bot", port: 0 });
    expect(bot.config.name).toBe("test-bot");
    expect(bot.config.port).toBe(0);
    expect(bot.isRunning).toBe(false);
  });

  it("starts and stops", async () => {
    bot = new Bot({ name: "test-bot", port: 0, logLevel: "silent" });
    await bot.start();
    expect(bot.isRunning).toBe(true);

    await bot.stop();
    expect(bot.isRunning).toBe(false);
  });

  it("dispatches commands via handleMessage", async () => {
    bot = new Bot({ name: "test-bot", port: 0, logLevel: "silent" });
    let replied = "";

    bot.command("ping", (ctx) => ctx.reply("pong"));

    await bot.handleMessage({
      command: "ping",
      args: [],
      replyFn: (msg) => { replied = msg; },
    });

    expect(replied).toBe("pong");
  });

  it("supports middleware", async () => {
    bot = new Bot({ name: "test-bot", port: 0, logLevel: "silent" });
    const order: string[] = [];

    bot.use(async (_ctx, next) => {
      order.push("middleware");
      await next();
    });

    bot.command("test", async () => {
      order.push("handler");
    });

    await bot.handleMessage({
      command: "test",
      args: [],
      replyFn: () => {},
    });

    expect(order).toEqual(["middleware", "handler"]);
  });

  it("loads plugins on start", async () => {
    bot = new Bot({ name: "test-bot", port: 0, logLevel: "silent" });
    let pluginLoaded = false;

    const myPlugin: Plugin = {
      name: "test-plugin",
      setup(b) {
        pluginLoaded = true;
        b.command("from-plugin", (ctx) => ctx.reply("plugin-reply"));
      },
    };

    bot.plugin(myPlugin);
    await bot.start();

    expect(pluginLoaded).toBe(true);

    // Verify plugin-registered command works
    let replied = "";
    await bot.handleMessage({
      command: "from-plugin",
      args: [],
      replyFn: (msg) => { replied = msg; },
    });
    expect(replied).toBe("plugin-reply");
  });

  it("emits start and stop events", async () => {
    bot = new Bot({ name: "test-bot", port: 0, logLevel: "silent" });
    const events: string[] = [];

    bot.on("start", () => { events.push("started"); });
    bot.on("stop", () => { events.push("stopped"); });

    await bot.start();
    expect(events).toEqual(["started"]);

    await bot.stop();
    expect(events).toEqual(["started", "stopped"]);
  });

  it("chainable API returns this", () => {
    bot = new Bot({ name: "test-bot", port: 0 });

    const result = bot
      .command("a", () => {})
      .use(async (_ctx, next) => next())
      .on("x", () => {})
      .plugin({ name: "p", setup: () => {} });

    expect(result).toBe(bot);
  });

  it("does not start twice", async () => {
    bot = new Bot({ name: "test-bot", port: 0, logLevel: "silent" });
    await bot.start();
    await bot.start(); // should be no-op
    expect(bot.isRunning).toBe(true);
  });
});
