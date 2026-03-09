import type { LLMConfig, Provider, TaskType } from "../types.ts"

function detectProvider(model: string): Provider {
  if (model.startsWith("claude-")) return "anthropic"
  if (model.startsWith("gpt-") || model.startsWith("o1-") || model.startsWith("o3-")) return "openai"
  return "openrouter"
}

function getApiKey(provider: Provider): string {
  const keyMap: Record<Provider, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  }
  const envVar = keyMap[provider]
  const key = Bun.env[envVar]
  if (!key) {
    throw new Error(
      `Missing required environment variable: ${envVar}\n` +
        `Set it to use the ${provider} provider.\n` +
        `Example: export ${envVar}=your-api-key-here`
    )
  }
  return key
}

export function routeModel(taskType: TaskType): LLMConfig {
  let model: string

  if (taskType === "plan") {
    model = Bun.env["PLANNER_MODEL"] ?? "claude-opus-4-5"
  } else if (taskType === "execute") {
    model = Bun.env["EXECUTOR_MODEL"] ?? "claude-haiku-4-5-20251001"
  } else {
    // compact
    model = Bun.env["COMPACT_MODEL"] ?? Bun.env["EXECUTOR_MODEL"] ?? "claude-haiku-4-5-20251001"
  }

  const provider = detectProvider(model)
  const apiKey = getApiKey(provider)

  return { provider, model, apiKey }
}
