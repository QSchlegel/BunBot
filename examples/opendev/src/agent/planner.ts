import type { LLMConfig, Message } from "../types.ts"
import { chat as anthropicChat } from "../llm/providers/anthropic.ts"
import { chat as openaiChat } from "../llm/providers/openai.ts"
import { chat as openrouterChat } from "../llm/providers/openrouter.ts"

const PLANNER_SYSTEM = `You are a senior software engineer acting as a task planner.
Given a coding task, produce a numbered step-by-step execution plan.
Each step must be atomic: a single shell command, file read, file write, or search.
Respond ONLY with valid JSON in this exact format: {"steps": ["step 1...", "step 2...", ...]}
Do not include explanation outside the JSON.`

async function collectStream(gen: AsyncGenerator<string>): Promise<string> {
  let result = ""
  for await (const token of gen) {
    if (!token.startsWith("[TOOL_CALL:")) {
      result += token
    }
  }
  return result.trim()
}

async function callLLM(
  config: LLMConfig,
  messages: Message[]
): Promise<string> {
  if (config.provider === "anthropic") {
    return collectStream(anthropicChat(config, messages))
  } else if (config.provider === "openai") {
    return collectStream(openaiChat(config, messages))
  } else {
    return collectStream(openrouterChat(config, messages))
  }
}

function parseSteps(raw: string): string[] {
  // Try to find JSON block even if surrounded by prose
  const jsonMatch = raw.match(/\{[\s\S]*"steps"[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : raw

  const parsed = JSON.parse(jsonStr) as { steps: unknown }

  if (!parsed.steps || !Array.isArray(parsed.steps)) {
    throw new Error("Response missing 'steps' array")
  }

  const steps = parsed.steps as unknown[]

  if (steps.length === 0 || steps.length > 20) {
    throw new Error(`Invalid steps count: ${steps.length} (must be 1–20)`)
  }

  for (const step of steps) {
    if (typeof step !== "string") {
      throw new Error("All steps must be strings")
    }
  }

  return steps as string[]
}

export async function plan(
  task: string,
  context: Message[],
  llmConfig: LLMConfig
): Promise<string[]> {
  const messages: Message[] = [
    { role: "system", content: PLANNER_SYSTEM },
    ...context,
    { role: "user", content: task },
  ]

  const raw = await callLLM(llmConfig, messages)

  try {
    return parseSteps(raw)
  } catch {
    // Retry with stricter prompt
    const retryMessages: Message[] = [
      {
        role: "system",
        content:
          PLANNER_SYSTEM +
          "\n\nCRITICAL: Your previous response failed to parse. Output ONLY the raw JSON object, nothing else. No markdown, no explanation.",
      },
      { role: "user", content: task },
      { role: "assistant", content: raw },
      {
        role: "user",
        content:
          'Your response was not valid JSON with a "steps" array. Please try again with ONLY the JSON object.',
      },
    ]

    const retryRaw = await callLLM(llmConfig, retryMessages)
    return parseSteps(retryRaw)
  }
}
