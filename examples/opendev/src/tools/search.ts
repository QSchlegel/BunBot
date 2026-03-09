import type { Tool } from "../types.ts"
import { join } from "path"

const MAX_LINES = 100

const searchTool: Tool = {
  name: "search",
  description: "Search for a text pattern across files in the workspace",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Text pattern to search for" },
      path: {
        type: "string",
        description: "Directory path to search in (optional, defaults to workspace root)",
      },
      glob: {
        type: "string",
        description: "File glob pattern to filter files (optional, e.g. '*.ts')",
      },
    },
    required: ["pattern"],
  },

  async execute(
    args: Record<string, unknown>,
    workspaceRoot: string
  ): Promise<string> {
    const pattern = args["pattern"] as string
    const searchPath = args["path"]
      ? join(workspaceRoot, args["path"] as string)
      : workspaceRoot
    const glob = (args["glob"] as string | undefined) ?? "*"

    try {
      const result = await Bun.$`grep -r --include=${glob} -n ${pattern} ${searchPath}`
        .nothrow()
        .quiet()

      const output = result.stdout.toString()
      if (!output.trim()) {
        return `No matches found for pattern: ${pattern}`
      }

      const lines = output.split("\n").filter(Boolean)
      if (lines.length > MAX_LINES) {
        return (
          lines.slice(0, MAX_LINES).join("\n") +
          `\n[...truncated, ${lines.length} total matches]`
        )
      }

      return lines.join("\n")
    } catch (err) {
      if (err instanceof Error) {
        return `[search error] ${err.message}`
      }
      return `[search error] Unknown error`
    }
  },
}

export default async function loadSearchTool(): Promise<Tool> {
  return searchTool
}
