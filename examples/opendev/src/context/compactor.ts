import type { LLMConfig, Message, ToolSchema } from "../types.ts"
import { ContextWindow } from "./window.ts"
import { chat as anthropicChat } from "../llm/providers/anthropic.ts"
import { chat as openaiChat } from "../llm/providers/openai.ts"
import { chat as openrouterChat } from "../llm/providers/openrouter.ts"

const COMPACTION_SYSTEM_PROMPT = `You are a memory compactor for an AI coding agent. Summarize the following agent \
observations into a concise bullet list. Preserve: file paths created or modified, \
shell commands run and their outcomes, key decisions made, errors encountered and \
how they were resolved. Be terse — this replaces working memory.`

export type ChatFn = (
  config: LLMConfig,
  messages: Message[],
  tools?: ToolSchema[]
) => AsyncGenerator<string>

async function collectStream(gen: AsyncGenerator<string>): Promise<string> {
  let result = ""
  for await (const token of gen) {
    // Skip tool call markers in compaction
    if (!token.startsWith("[TOOL_CALL:")) {
      result += token
    }
  }
  return result.trim()
}

function selectChat(llmConfig: LLMConfig, chatFn?: ChatFn): ChatFn {
  if (chatFn) return chatFn
  if (llmConfig.provider === "anthropic") return anthropicChat as ChatFn
  if (llmConfig.provider === "openai") return openaiChat as ChatFn
  return openrouterChat as ChatFn
}

export async function compact(
  window: ContextWindow,
  llmConfig: LLMConfig,
  chatFn?: ChatFn
): Promise<void> {
  const messages = window.getMessages()

  if (messages.length < 3) return

  // Always keep first message (original task) and last 4 messages
  const first = messages[0]!
  const last4 = messages.slice(-4)
  const middleMessages = messages.slice(1, -4)

  if (middleMessages.length < 2) return

  const tokensBefore = window.getTokenCount()
  const messageBefore = messages.length

  // Build compaction request
  const compactionMessages: Message[] = [
    { role: "system", content: COMPACTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: middleMessages.map((m) => `[${m.role}]: ${m.content}`).join("\n\n"),
    },
  ]

  const chat = selectChat(llmConfig, chatFn)
  const summary = await collectStream(chat(llmConfig, compactionMessages))

  const compactedMessage: Message = {
    role: "system",
    content: `[COMPACTED MEMORY]\n${summary}`,
  }

  window.messages = [first, compactedMessage, ...last4]

  const tokensAfter = window.getTokenCount()
  const saved = tokensBefore - tokensAfter

  process.stderr.write(
    `[compaction] ${messageBefore} messages → 1 summary, saved ~${saved} tokens\n`
  )
}
