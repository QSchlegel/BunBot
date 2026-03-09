import type { Tool } from "../types.ts"
import { join } from "path"

const fileWriteTool: Tool = {
  name: "file_write",
  description: "Write content to a file, creating it if it does not exist",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file (relative to workspace root)" },
      content: { type: "string", description: "Content to write to the file" },
    },
    required: ["path", "content"],
  },

  async execute(
    args: Record<string, unknown>,
    workspaceRoot: string
  ): Promise<string> {
    const filePath = args["path"] as string
    const content = args["content"] as string

    const resolvedPath = filePath.startsWith("/")
      ? filePath
      : join(workspaceRoot, filePath)

    await Bun.write(resolvedPath, content)
    return `Written ${content.length} chars to ${resolvedPath}`
  },
}

export default async function loadFileWriteTool(): Promise<Tool> {
  return fileWriteTool
}
