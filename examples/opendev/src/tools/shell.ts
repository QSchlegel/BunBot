import type { Tool } from "../types.ts"
import { validateCommand } from "../safety/guard.ts"

const shellTool: Tool = {
  name: "shell",
  description: "Run a shell command in the workspace directory",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to run" },
      cwd: { type: "string", description: "Working directory (optional, defaults to workspace root)" },
    },
    required: ["command"],
  },

  async execute(
    args: Record<string, unknown>,
    workspaceRoot: string
  ): Promise<string> {
    const command = args["command"] as string
    const cwd = (args["cwd"] as string | undefined) ?? workspaceRoot

    const validation = validateCommand(command, workspaceRoot)
    if (!validation.allowed) {
      throw new Error(`Command blocked by safety guard: ${validation.reason}`)
    }

    try {
      const result = await Bun.$`sh -c ${command}`
        .cwd(cwd)
        .timeout(30000)
        .nothrow()
        .quiet()

      const stdout = result.stdout.toString()
      const stderr = result.stderr.toString()
      const combined = [stdout, stderr].filter(Boolean).join("\n")

      if (result.exitCode !== 0) {
        return `[exit ${result.exitCode}] ${combined}`
      }

      return combined || "(no output)"
    } catch (err) {
      if (err instanceof Error) {
        return `[error] ${err.message}`
      }
      return `[error] Unknown error`
    }
  },
}

export default async function loadShellTool(): Promise<Tool> {
  return shellTool
}
