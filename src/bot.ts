import { resolveConfig } from "./config";
import { Context } from "./context";
import { Logger } from "./logger";
import { Router } from "./router";
import { HealthServer } from "./server";
import { Telemetry } from "./telemetry";
import { LangfuseIntegration } from "./langfuse";
import { createProvider } from "./llm/provider";
import type { LLMProvider } from "./llm/types";
import type {
  BotConfig,
  CommandHandler,
  EventHandler,
  Middleware,
  Plugin,
  ReplyFn,
  ResolvedBotConfig,
} from "./types";

export class Bot {
  readonly config: ResolvedBotConfig;
  readonly log: Logger;

  private router = new Router();
  private server: HealthServer;
  private telemetry: Telemetry;
  private langfuse: LangfuseIntegration | null = null;
  private llmProvider: LLMProvider | null = null;
  private plugins: Plugin[] = [];
  private _running = false;
  private _shutdownHandlers: (() => void)[] = [];

  constructor(config: Partial<BotConfig>) {
    this.config = resolveConfig(config);
    this.log = new Logger(this.config.logLevel, this.config.name);
    this.server = new HealthServer({
      port: this.config.port,
      healthPath: this.config.healthPath,
    });
    this.telemetry = new Telemetry(this.config.telemetry);
  }

  command(name: string, handler: CommandHandler): this {
    this.router.command(name, handler);
    return this;
  }

  use(middleware: Middleware): this {
    this.router.use(middleware);
    return this;
  }

  on<T = unknown>(event: string, handler: EventHandler<T>): this {
    this.router.on(event, handler);
    return this;
  }

  plugin(p: Plugin): this {
    this.plugins.push(p);
    return this;
  }

  async start(): Promise<void> {
    if (this._running) return;

    // Initialize LLM provider
    if (this.config.llm) {
      this.llmProvider = createProvider(this.config.llm);
    }

    // Initialize Langfuse
    if (this.config.langfuse) {
      this.langfuse = new LangfuseIntegration(this.config.langfuse);
      await this.langfuse.init();

      if (this.langfuse.isEnabled && this.llmProvider) {
        this.llmProvider = this.langfuse.wrapProvider(this.llmProvider);
      }
    }

    // Initialize telemetry
    await this.telemetry.init();

    // Load plugins
    for (const p of this.plugins) {
      this.log.debug(`Loading plugin: ${p.name}`);
      await p.setup(this);
    }

    // Start HTTP server
    this.server.start(async (body) => {
      let reply: string | null = null;

      await this.handleMessage({
        command: body.command,
        args: body.args ?? [],
        raw: body,
        replyFn: (msg) => {
          reply = msg;
        },
      });

      return reply;
    });

    // Register shutdown handlers
    const shutdown = async () => {
      await this.stop();
      process.exit(0);
    };

    const sigintHandler = () => { shutdown(); };
    const sigtermHandler = () => { shutdown(); };

    process.on("SIGINT", sigintHandler);
    process.on("SIGTERM", sigtermHandler);

    this._shutdownHandlers.push(
      () => process.removeListener("SIGINT", sigintHandler),
      () => process.removeListener("SIGTERM", sigtermHandler),
    );

    this._running = true;
    await this.router.emit("start", { name: this.config.name });

    if (this.server.isRunning) {
      this.log.info("Bot started", { port: this.server.port });
    } else {
      this.log.info("Bot started", { port: 0, server: false });
    }
  }

  async stop(): Promise<void> {
    if (!this._running) return;

    await this.router.emit("stop", { name: this.config.name });

    this.server.stop();

    // Flush Langfuse
    if (this.langfuse) {
      await this.langfuse.flush();
    }

    // Clean up shutdown handlers
    for (const cleanup of this._shutdownHandlers) {
      cleanup();
    }
    this._shutdownHandlers = [];

    this._running = false;
    this.log.info("Bot stopped");
  }

  async handleMessage(opts: {
    command: string;
    args: string[];
    raw?: unknown;
    replyFn: ReplyFn;
  }): Promise<void> {
    const ctx = new Context({
      command: opts.command,
      args: opts.args,
      raw: opts.raw ?? null,
      replyFn: opts.replyFn,
      llm: this.llmProvider,
    });

    const startTime = Date.now();
    let status: "ok" | "error" = "ok";

    const langfuseTrace = this.langfuse?.traceCommand(opts.command);

    try {
      await this.telemetry.createSpan(`command.${opts.command}`, async () => {
        await this.router.dispatch(ctx);
      });
    } catch (error) {
      status = "error";
      this.log.error(`Command "${opts.command}" failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      const durationMs = Date.now() - startTime;
      this.telemetry.recordCommand(opts.command, durationMs, status);
      langfuseTrace?.end();
    }
  }

  get isRunning(): boolean {
    return this._running;
  }

  get serverPort(): number {
    return this.server.port;
  }
}
