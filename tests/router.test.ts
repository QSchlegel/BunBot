import { describe, it, expect } from "bun:test";
import { Router } from "../src/router";
import { Context } from "../src/context";

function makeCtx(command: string, args: string[] = []): { ctx: Context; getReplied: () => string } {
  let replied = "";
  const ctx = new Context({
    command,
    args,
    raw: null,
    replyFn: (msg) => { replied = msg; },
  });
  return { ctx, getReplied: () => replied };
}

describe("Router", () => {
  it("dispatches to a registered command", async () => {
    const router = new Router();
    router.command("ping", async (ctx) => ctx.reply("pong"));

    const { ctx, getReplied } = makeCtx("ping");
    await router.dispatch(ctx);

    expect(getReplied()).toBe("pong");
  });

  it("emits 'unhandled' for unknown commands", async () => {
    const router = new Router();
    let unhandledCommand = "";

    router.on("unhandled", (payload: any) => {
      unhandledCommand = payload.command;
    });

    const { ctx } = makeCtx("unknown");
    await router.dispatch(ctx);

    expect(unhandledCommand).toBe("unknown");
  });

  it("runs middleware in order (onion model)", async () => {
    const router = new Router();
    const order: string[] = [];

    router.use(async (_ctx, next) => {
      order.push("m1-before");
      await next();
      order.push("m1-after");
    });

    router.use(async (_ctx, next) => {
      order.push("m2-before");
      await next();
      order.push("m2-after");
    });

    router.command("test", async () => {
      order.push("handler");
    });

    const { ctx } = makeCtx("test");
    await router.dispatch(ctx);

    expect(order).toEqual(["m1-before", "m2-before", "handler", "m2-after", "m1-after"]);
  });

  it("middleware can short-circuit by not calling next", async () => {
    const router = new Router();
    let handlerCalled = false;

    router.use(async (ctx, _next) => {
      await ctx.reply("blocked");
      // Not calling next()
    });

    router.command("test", async () => {
      handlerCalled = true;
    });

    const { ctx, getReplied } = makeCtx("test");
    await router.dispatch(ctx);

    expect(handlerCalled).toBe(false);
    expect(getReplied()).toBe("blocked");
  });

  it("emits events to all handlers", async () => {
    const router = new Router();
    const results: string[] = [];

    router.on("myevent", (payload: any) => { results.push(`a:${payload.val}`); });
    router.on("myevent", (payload: any) => { results.push(`b:${payload.val}`); });

    await router.emit("myevent", { val: "x" });

    expect(results).toEqual(["a:x", "b:x"]);
  });

  it("hasCommand returns true for registered commands", () => {
    const router = new Router();
    router.command("ping", async () => {});

    expect(router.hasCommand("ping")).toBe(true);
    expect(router.hasCommand("nope")).toBe(false);
  });
});
