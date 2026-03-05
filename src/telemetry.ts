import type { TelemetryConfig } from "./types";

type Tracer = any;
type Meter = any;
type Span = any;

export class Telemetry {
  private tracer: Tracer | null = null;
  private meter: Meter | null = null;
  private enabled = false;
  private commandCounter: any = null;
  private commandDuration: any = null;

  constructor(private config: TelemetryConfig) {
    this.enabled = config.enabled ?? false;
  }

  async init(): Promise<void> {
    if (!this.enabled) return;

    try {
      // @ts-ignore - @opentelemetry/api is an optional peer dependency
      const otel = await import("@opentelemetry/api");
      const serviceName = this.config.serviceName ?? "bunbot";

      this.tracer = otel.trace.getTracer(serviceName);
      this.meter = otel.metrics.getMeter(serviceName);

      this.commandCounter = this.meter.createCounter("bunbot.commands.total", {
        description: "Total number of commands dispatched",
      });

      this.commandDuration = this.meter.createHistogram("bunbot.commands.duration_ms", {
        description: "Command dispatch duration in milliseconds",
      });
    } catch {
      // @opentelemetry/api not installed — stay disabled
      this.enabled = false;
    }
  }

  async createSpan<T>(name: string, fn: (span?: Span) => Promise<T>): Promise<T> {
    if (!this.enabled || !this.tracer) {
      return fn();
    }

    return this.tracer.startActiveSpan(name, async (span: Span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({
          code: 2, // ERROR
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  recordCommand(command: string, durationMs: number, status: "ok" | "error"): void {
    if (!this.enabled) return;

    this.commandCounter?.add(1, { command, status });
    this.commandDuration?.record(durationMs, { command, status });
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}
