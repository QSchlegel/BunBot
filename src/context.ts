import type { ReplyFn } from "./types";
import type { LLMProvider } from "./llm/types";

export interface ContextOptions {
  command: string;
  args: string[];
  raw: unknown;
  replyFn: ReplyFn;
  llm?: LLMProvider | null;
}

export class Context {
  readonly command: string;
  readonly args: string[];
  readonly raw: unknown;
  readonly state: Record<string, unknown> = {};
  readonly llm: LLMProvider | null;

  private _replied = false;
  private _replyFn: ReplyFn;

  constructor(opts: ContextOptions) {
    this.command = opts.command;
    this.args = opts.args;
    this.raw = opts.raw;
    this._replyFn = opts.replyFn;
    this.llm = opts.llm ?? null;
  }

  async reply(message: string): Promise<void> {
    await this._replyFn(message);
    this._replied = true;
  }

  get replied(): boolean {
    return this._replied;
  }
}
