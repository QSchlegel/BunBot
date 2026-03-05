import type { BotConfig, ResolvedBotConfig } from "./types";

const DEFAULTS: ResolvedBotConfig = {
  name: "bunbot",
  port: 3000,
  healthPath: "/health",
  logLevel: "info",
  env: {},
  llm: null,
  langfuse: null,
  telemetry: { enabled: false },
};

export function resolveConfig(userConfig: Partial<BotConfig>): ResolvedBotConfig {
  const env = { ...DEFAULTS.env, ...userConfig.env };

  const name =
    userConfig.name ??
    process.env.BUNBOT_NAME ??
    DEFAULTS.name;

  const port =
    userConfig.port ??
    (process.env.BUNBOT_PORT ? parseInt(process.env.BUNBOT_PORT, 10) : DEFAULTS.port);

  const healthPath =
    userConfig.healthPath ??
    process.env.BUNBOT_HEALTH_PATH ??
    DEFAULTS.healthPath;

  const logLevel =
    userConfig.logLevel ??
    (process.env.BUNBOT_LOG_LEVEL as BotConfig["logLevel"]) ??
    DEFAULTS.logLevel;

  const llm = userConfig.llm ?? null;

  const langfuse = userConfig.langfuse ?? null;

  const telemetry = {
    enabled: userConfig.telemetry?.enabled ?? DEFAULTS.telemetry.enabled,
    serviceName: userConfig.telemetry?.serviceName ?? name,
  };

  return { name, port, healthPath, logLevel, env, llm, langfuse, telemetry };
}
