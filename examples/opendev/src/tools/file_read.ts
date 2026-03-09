import type { Tool } from "../types.ts"
import { join } from "path"

const MAX_CHARS = 8000

const fileReadTool: Tool = {
  name: "file_read",
  description: "Read the contents of a file",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file (relative to workspace root)" },
    },
    required: ["path"],
  },

  async execute(
    args: Record<string, unknown>,
    workspaceRoot: string
  ): Promise<string> {
    const filePath = args["path"] as string
    const resolvedPath = filePath.startsWith("/")
      ? filePath
      : join(workspaceRoot, filePath)

    const file = Bun.file(resolvedPath)
    const content = await file.text()

    if (content.length > MAX_CHARS) {
      const truncated = content.slice(0, MAX_CHARS)
      return `${truncated}\n[...truncated, ${content.length} chars total]`
    }

    return content
  },
}

export default async function loadFileReadTool(): Promise<Tool> {
  return fileReadTool
}
