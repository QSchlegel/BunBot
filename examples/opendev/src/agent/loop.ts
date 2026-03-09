import type { Message } from "../types.ts"
import { registerTool, getToolsForLLM } from "../tools/registry.ts"
import { ContextWindow } from "../context/window.ts"
import { compact } from "../context/compactor.ts"
import { plan } from "./planner.ts"
import { executeStep } from "./executor.ts"
import { routeModel } from "../llm/router.ts"

export async function runAgent(
  task: string,
  workspaceRoot: string,
  options: { maxTokens?: number; dryRun?: boolean }
): Promise<void> {
  // Register all tools lazily
  registerTool("shell", () => import("../tools/shell.ts").then((m) => m.default()))
  registerTool("file_read", () => import("../tools/file_read.ts").then((m) => m.default()))
  registerTool("file_write", () => import("../tools/file_write.ts").then((m) => m.default()))
  registerTool("search", () => import("../tools/search.ts").then((m) => m.default()))

  // Initialize context window
  const window = new ContextWindow(options.maxTokens ?? 80000)

  // Add task as first user message
  window.addMessage({ role: "user", content: task })

  // Plan the task
  const plannerConfig = routeModel("plan")
  const steps = await plan(task, [], plannerConfig)

  // Print the plan
  for (let i = 0; i < steps.length; i++) {
    process.stdout.write(`[plan] ${i + 1}. ${steps[i]}\n`)
  }

  if (options.dryRun) {
    process.stdout.write("[dry-run] Stopping before execution.\n")
    return
  }

  // Execute each step
  const executorConfig = routeModel("execute")
  const compactConfig = routeModel("compact")

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!
    process.stdout.write(`\n[exec] Step ${i + 1}: ${step}\n`)

    const tools = await getToolsForLLM()
    const context = window.getMessages()

    const { observation, toolsUsed } = await executeStep(
      step,
      context,
      tools,
      executorConfig,
      workspaceRoot
    )

    process.stdout.write(`[obs] ${observation}\n`)

    for (const toolName of toolsUsed) {
      process.stdout.write(`[tool] ${toolName}\n`)
    }

    // Add step and observation to context
    window.addMessage({ role: "user", content: `Step: ${step}` })
    window.addMessage({ role: "assistant", content: observation })

    // Compact if needed
    if (window.needsCompaction()) {
      await compact(window, compactConfig)
    }
  }

  process.stdout.write("\n[done] Task complete.\n")
}
