import type { LLMConfig, Message, ToolSchema } from "../../types.ts"

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function* chat(
  config: LLMConfig,
  messages: Message[],
  tools?: ToolSchema[]
): AsyncGenerator<string> {
  // Separate system messages from conversation messages
  const systemMessages = messages.filter((m) => m.role === "system")
  const conversationMessages = messages.filter((m) => m.role !== "system")

  const systemPrompt = systemMessages.map((m) => m.content).join("\n\n")

  const anthropicMessages = conversationMessages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result",
            tool_use_id: m.toolCallId ?? "unknown",
            content: m.content,
          },
        ],
      }
    }
    return {
      role: m.role as "user" | "assistant",
      content: m.content,
    }
  })

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    stream: true,
    messages: anthropicMessages,
  }

  if (systemPrompt) {
    body["system"] = systemPrompt
  }

  if (tools && tools.length > 0) {
    body["tools"] = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }))
  }

  let retries = 0
  const maxRetries = 3

  while (true) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (response.status === 429 && retries < maxRetries) {
      retries++
      await sleep(1000 * Math.pow(2, retries))
      continue
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${text}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    // Track tool use blocks being accumulated
    let currentToolName = ""
    let currentToolId = ""
    let currentToolInput = ""
    let inToolUse = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n")

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]" || !data) continue

        let event: Record<string, unknown>
        try {
          event = JSON.parse(data)
        } catch {
          continue
        }

        const type = event["type"] as string

        if (type === "content_block_start") {
          const block = event["content_block"] as Record<string, unknown>
          if (block?.["type"] === "tool_use") {
            inToolUse = true
            currentToolName = (block["name"] as string) ?? ""
            currentToolId = (block["id"] as string) ?? ""
            currentToolInput = ""
          }
        } else if (type === "content_block_delta") {
          const delta = event["delta"] as Record<string, unknown>
          if (delta?.["type"] === "text_delta") {
            yield delta["text"] as string
          } else if (delta?.["type"] === "input_json_delta" && inToolUse) {
            currentToolInput += (delta["partial_json"] as string) ?? ""
          }
        } else if (type === "content_block_stop" && inToolUse) {
          inToolUse = false
          let inputObj: Record<string, unknown> = {}
          try {
            inputObj = JSON.parse(currentToolInput || "{}")
          } catch {
            inputObj = {}
          }
          yield `[TOOL_CALL:${JSON.stringify({
            name: currentToolName,
            input: inputObj,
            id: currentToolId,
          })}]`
          currentToolName = ""
          currentToolId = ""
          currentToolInput = ""
        }
      }
    }
    return
  }
}
