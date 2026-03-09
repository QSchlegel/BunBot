import { describe, test, expect, mock, beforeEach } from "bun:test"
import { validateCommand } from "../safety/guard.ts"
import { ContextWindow } from "../context/window.ts"
import { registerTool, getTool, listAvailableTools } from "../tools/registry.ts"
import type { LLMConfig, Message } from "../types.ts"

// ── Test 1: Safety guard blocks rm -rf / ─────────────────────────────────────

describe("safety guard", () => {
  test("blocks rm -rf /", () => {
    const result = validateCommand("rm -rf /", "/workspace")
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  test("allows ls -la", () => {
    const result = validateCommand("ls -la", "/workspace")
    expect(result.allowed).toBe(true)
  })
})

// ── Test 2: file_read reads a real file ───────────────────────────────────────

describe("file_read tool", () => {
  test("reads the test file itself and finds bun:test", async () => {
    const { default: loadFileRead } = await import("../tools/file_read.ts")
    const tool = await loadFileRead()
    const content = await tool.execute({ path: import.meta.path }, "/")
    expect(content).toContain("bun:test")
  })
})

// ── Test 3: Compactor reduces message count ───────────────────────────────────

describe("compactor", () => {
  test("reduces message count after compaction", async () => {
    const window = new ContextWindow(80000)

    // Add 11 messages: 1 original task + 5 middle pairs + 4 last messages
    window.addMessage({ role: "user", content: "Original task: write some code" })
    for (let i = 0; i < 5; i++) {
      window.addMessage({
        role: "assistant",
        content: `I created file${i}.ts and ran npm install. Everything worked fine with exit code 0.`,
      })
      window.addMessage({
        role: "user",
        content: `Step ${i + 1} result: success. Moving on to next step.`,
      })
    }

    // Add 4 final messages
    for (let i = 0; i < 4; i++) {
      window.addMessage({ role: "user", content: `Final step ${i}` })
    }

    expect(window.getMessages().length).toBe(15)

    const mockConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      apiKey: "test-key",
    }

    // Inject a mock chat function — no need to mutate module exports
    const mockChatFn = async function* () {
      yield "- did stuff\n- wrote files\n- all tests passed"
    }

    const { compact } = await import("../context/compactor.ts")
    await compact(window, mockConfig, mockChatFn)

    // Should have: [original task] + [compacted summary] + [last 4 messages] = 6
    expect(window.getMessages().length).toBeLessThanOrEqual(6)
  })
})

// ── Test 4: Tool registry lazy-loads ──────────────────────────────────────────

describe("tool registry", () => {
  test("lazy-loads tools only when getTool() is called", async () => {
    let loaded = false
    const testToolName = `test-lazy-tool-${Date.now()}`

    registerTool(testToolName, async () => {
      loaded = true
      return {
        name: testToolName,
        description: "A test tool",
        parameters: { type: "object", properties: {} },
        async execute() {
          return "ok"
        },
      }
    })

    // Listing tools should NOT trigger loading
    const names = listAvailableTools()
    expect(names).toContain(testToolName)
    expect(loaded).toBe(false)

    // Getting the tool SHOULD trigger loading
    await getTool(testToolName)
    expect(loaded).toBe(true)
  })
})
