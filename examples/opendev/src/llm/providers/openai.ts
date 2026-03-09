import type { LLMConfig, Message, ToolSchema } from "../../types.ts"

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function* chat(
  config: LLMConfig,
  messages: Message[],
  tools?: ToolSchema[],
  baseUrl = "https://api.openai.com/v1"
): AsyncGenerator<string> {
  const openAIMessages = messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        tool_call_id: m.toolCallId ?? "unknown",
      }
    }
    return {
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }
  })

  const body: Record<string, unknown> = {
    model: config.model,
    messages: openAIMessages,
    stream: true,
  }

  if (tools && tools.length > 0) {
    body["tools"] = tools
    body["tool_choice"] = "auto"
  }

  let retries = 0
  const maxRetries = 3

  // Accumulate tool call deltas across chunks
  const toolCallAccumulator: Map<
    number,
    { id: string; name: string; arguments: string }
  > = new Map()

  while (true) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
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
      throw new Error(`OpenAI API error ${response.status}: ${text}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n")

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") {
          // Emit any accumulated tool calls
          for (const [, tc] of toolCallAccumulator) {
            let args: Record<string, unknown> = {}
            try {
              args = JSON.parse(tc.arguments || "{}")
            } catch {
              args = {}
            }
            yield `[TOOL_CALL:${JSON.stringify({ name: tc.name, arguments: args, id: tc.id })}]`
          }
          toolCallAccumulator.clear()
          continue
        }
        if (!data) continue

        let event: Record<string, unknown>
        try {
          event = JSON.parse(data)
        } catch {
          continue
        }

        const choices = event["choices"] as Array<Record<string, unknown>>
        if (!choices?.length) continue

        const delta = choices[0]?.["delta"] as Record<string, unknown>
        if (!delta) continue

        // Text content
        if (typeof delta["content"] === "string") {
          yield delta["content"]
        }

        // Tool calls
        const toolCalls = delta["tool_calls"] as Array<Record<string, unknown>> | undefined
        if (toolCalls) {
          for (const tc of toolCalls) {
            const index = (tc["index"] as number) ?? 0
            const existing = toolCallAccumulator.get(index) ?? {
              id: "",
              name: "",
              arguments: "",
            }

            if (tc["id"]) existing.id = tc["id"] as string
            const fn = tc["function"] as Record<string, unknown> | undefined
            if (fn?.["name"]) existing.name = fn["name"] as string
            if (fn?.["arguments"]) existing.arguments += fn["arguments"] as string

            toolCallAccumulator.set(index, existing)
          }
        }
      }
    }
    return
  }
}
