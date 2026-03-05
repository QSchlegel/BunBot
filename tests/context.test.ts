import { describe, it, expect } from "bun:test";
import { Context } from "../src/context";

describe("Context", () => {
  it("stores command, args, and raw", () => {
    const ctx = new Context({
      command: "ping",
      args: ["foo", "bar"],
      raw: { original: true },
      replyFn: () => {},
    });

    expect(ctx.command).toBe("ping");
    expect(ctx.args).toEqual(["foo", "bar"]);
    expect(ctx.raw).toEqual({ original: true });
  });

  it("reply() calls replyFn and sets replied flag", async () => {
    let received = "";
    const ctx = new Context({
      command: "test",
      args: [],
      raw: null,
      replyFn: (msg) => { received = msg; },
    });

    expect(ctx.replied).toBe(false);
    await ctx.reply("hello");
    expect(ctx.replied).toBe(true);
    expect(received).toBe("hello");
  });

  it("supports async replyFn", async () => {
    let received = "";
    const ctx = new Context({
      command: "test",
      args: [],
      raw: null,
      replyFn: async (msg) => {
        await new Promise((r) => setTimeout(r, 1));
        received = msg;
      },
    });

    await ctx.reply("async hello");
    expect(received).toBe("async hello");
    expect(ctx.replied).toBe(true);
  });

  it("has a state object for metadata", () => {
    const ctx = new Context({
      command: "test",
      args: [],
      raw: null,
      replyFn: () => {},
    });

    ctx.state.userId = "123";
    expect(ctx.state.userId).toBe("123");
  });

  it("exposes llm provider when provided", () => {
    const mockLlm = { name: "mock", chat: async () => ({ content: "", model: "", usage: { promptTokens: 0, completionTokens: 0 } }) };
    const ctx = new Context({
      command: "test",
      args: [],
      raw: null,
      replyFn: () => {},
      llm: mockLlm,
    });

    expect(ctx.llm).toBe(mockLlm);
  });

  it("llm is null when not provided", () => {
    const ctx = new Context({
      command: "test",
      args: [],
      raw: null,
      replyFn: () => {},
    });

    expect(ctx.llm).toBeNull();
  });
});
