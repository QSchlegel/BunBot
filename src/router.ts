import type { Context } from "./context";
import type { CommandHandler, EventHandler, Middleware } from "./types";

export class Router {
  private commands = new Map<string, CommandHandler>();
  private middlewares: Middleware[] = [];
  private eventHandlers = new Map<string, EventHandler<any>[]>();

  command(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler);
  }

  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async dispatch(ctx: Context): Promise<void> {
    const handler = this.commands.get(ctx.command);

    const chain = this.buildChain(ctx, async () => {
      if (handler) {
        await handler(ctx);
      } else {
        await this.emit("unhandled", { command: ctx.command, args: ctx.args });
      }
    });

    await chain();
  }

  async emit<T = unknown>(event: string, payload: T): Promise<void> {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }

  hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  private buildChain(ctx: Context, final: () => Promise<void>): () => Promise<void> {
    let index = -1;

    const next = async (): Promise<void> => {
      index++;
      if (index < this.middlewares.length) {
        await this.middlewares[index](ctx, next);
      } else {
        await final();
      }
    };

    return next;
  }
}
