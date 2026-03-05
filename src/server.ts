export interface ServerConfig {
  port: number;
  healthPath: string;
}

export type MessageHandler = (body: { command: string; args?: string[] }) => Promise<string | null>;

export class HealthServer {
  private server: any = null;
  private startedAt: number = Date.now();

  constructor(private config: ServerConfig) {}

  start(onMessage?: MessageHandler): void {
    if (this.config.port <= 0) return;

    this.startedAt = Date.now();
    const { healthPath } = this.config;

    this.server = Bun.serve({
      port: this.config.port,
      fetch: async (req: Request) => {
        const url = new URL(req.url);

        if (req.method === "GET" && url.pathname === healthPath) {
          return Response.json({
            status: "ok",
            uptime: Math.floor((Date.now() - this.startedAt) / 1000),
          });
        }

        if (req.method === "POST" && url.pathname === "/message" && onMessage) {
          try {
            const body = await req.json() as { command: string; args?: string[] };

            if (!body.command || typeof body.command !== "string") {
              return Response.json({ error: "Missing 'command' field" }, { status: 400 });
            }

            const reply = await onMessage(body);
            return Response.json({ reply });
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }
        }

        return Response.json({ error: "Not found" }, { status: 404 });
      },
    });
  }

  stop(): void {
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
  }

  get isRunning(): boolean {
    return this.server !== null;
  }

  get port(): number {
    return this.server?.port ?? 0;
  }
}
