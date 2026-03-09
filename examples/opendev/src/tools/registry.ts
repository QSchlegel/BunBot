import type { Tool, ToolSchema } from "../types.ts"

type ToolEntry = {
  loader: () => Promise<Tool>
  instance?: Tool
}

const toolMap = new Map<string, ToolEntry>()

export function registerTool(name: string, loader: () => Promise<Tool>): void {
  toolMap.set(name, { loader })
}

export async function getTool(name: string): Promise<Tool> {
  const entry = toolMap.get(name)
  if (!entry) throw new Error(`Tool not found: ${name}`)

  if (!entry.instance) {
    entry.instance = await entry.loader()
    toolMap.set(name, entry)
  }

  return entry.instance
}

export function listAvailableTools(): string[] {
  return Array.from(toolMap.keys())
}

export async function getToolsForLLM(): Promise<ToolSchema[]> {
  const schemas: ToolSchema[] = []

  for (const name of toolMap.keys()) {
    const tool = await getTool(name)
    schemas.push({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })
  }

  return schemas
}
