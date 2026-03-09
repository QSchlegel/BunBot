import type { LLMConfig, Message, ToolSchema } from "../types.ts"
import { getTool } from "../tools/registry.ts"
import { chat as anthropicChat } from "../llm/providers/anthropic.ts"
import { chat as openaiChat } from "../llm/providers/openai.ts"
import { chat as openrouterChat } from "../llm/providers/openrouter.ts"

const EXECUTOR_SYSTEM = `You are an autonomous executor in a coding agent system.
Execute the given step using the available tools.
Call exactly one tool per response. After receiving the tool result,
assess if the step is complete. If complete, respond with your observation
as plain text (no tool call). If not complete, call another tool.
Never ask clarifying questions. Always act.`

const MAX_TOOL_CALLS = 10

const TOOL_CALL_REGEX = /\[TOOL_CALL:(\{.*?\})\]/

async function* callLLMStream(
  config: LLMConfig,
  messages: Message[],
  tools: ToolSchema[]
): AsyncGenerator<string> {
  if (config.provider === "anthropic") {
    yield* anthropicChat(config, messages, tools)
  } else if (config.provider === "openai") {
    yield* openaiChat(config, messages, tools)
  } else {
    yield* openrouterChat(config, messages, tools)
  }
}

interface ToolCallData {
  name: string
  input?: Record<string, unknown>
  arguments?: Record<string, unknown>
  id?: string
}

export async function executeStep(
  step: string,
  context: Message[],
  tools: ToolSchema[],
  llmConfig: LLMConfig,
  workspaceRoot: string
): Promise<{ observation: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = []

  const messages: Message[] = [
    { role: "system", content: EXECUTOR_SYSTEM },
    ...context,
    { role: "user", content: `Execute this step: ${step}` },
  ]

  let toolCallCount = 0

  while (toolCallCount < MAX_TOOL_CALLS) {
    // Collect full streamed response
    let fullResponse = ""
    process.stdout.write("") // ensure stdout is flushed

    for await (const token of callLLMStream(llmConfig, messages, tools)) {
      fullResponse += token
      // Stream text tokens to stdout (skip tool call markers)
      if (!token.startsWith("[TOOL_CALL:")) {
        process.stdout.write(token)
      }
    }

    // Check for tool call in response
    const toolCallMatch = fullResponse.match(/\[TOOL_CALL:(\{[\s\S]*?\})\]/)

    if (!toolCallMatch) {
      // No tool call — step is complete
      process.stdout.write("\n")
      const observation = fullResponse.replace(/\[TOOL_CALL:[\s\S]*?\]/g, "").trim()
      return { observation: observation || fullResponse.trim(), toolsUsed }
    }

    // Parse the tool call
    let toolCallData: ToolCallData
    try {
      toolCallData = JSON.parse(toolCallMatch[1]!) as ToolCallData
    } catch {
      process.stdout.write("\n")
      return {
        observation: `Failed to parse tool call: ${toolCallMatch[1]}`,
        toolsUsed,
      }
    }

    const toolName = toolCallData.name
    const toolArgs = toolCallData.input ?? toolCallData.arguments ?? {}
    const toolCallId = toolCallData.id ?? `call_${toolCallCount}`

    toolsUsed.push(toolName)
    toolCallCount++

    // Append assistant message with tool call
    messages.push({
      role: "assistant",
      content: fullResponse,
    })

    // Execute the tool
    let toolResult: string
    try {
      const tool = await getTool(toolName)
      toolResult = await tool.execute(toolArgs, workspaceRoot)
    } catch (err) {
      toolResult = `[tool error] ${err instanceof Error ? err.message : String(err)}`
    }

    // Append tool result
    messages.push({
      role: "tool",
      content: toolResult,
      toolCallId,
      toolName,
    })
  }

  // Forced completion after max tool calls
  return {
    observation: `Step completed after ${MAX_TOOL_CALLS} tool calls (limit reached).`,
    toolsUsed,
  }
}
