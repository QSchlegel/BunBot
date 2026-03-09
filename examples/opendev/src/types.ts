export type Role = "system" | "user" | "assistant" | "tool"

export type Message = {
  role: Role
  content: string
  toolCallId?: string
  toolName?: string
}

export type JSONSchema = Record<string, unknown>

export type Tool = {
  name: string
  description: string
  parameters: JSONSchema
  execute(args: Record<string, unknown>, workspaceRoot: string): Promise<string>
}

export type ToolSchema = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: JSONSchema
  }
}

export type Provider = "anthropic" | "openai" | "openrouter"

export type LLMConfig = {
  provider: Provider
  model: string
  apiKey: string
}

export type TaskType = "plan" | "execute" | "compact"
