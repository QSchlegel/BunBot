#!/usr/bin/env bun
import { runAgent } from "./agent/loop.ts"

const USAGE = `Usage: opendev <task> [--workspace <dir>] [--max-tokens <n>] [--dry-run]

Examples:
  opendev "fix the failing tests"
  echo "add error handling to api.ts" | opendev
  opendev "refactor auth module" --workspace ./src --dry-run`

function parseArgs(args: string[]): {
  task: string | null
  workspaceRoot: string
  maxTokens: number
  dryRun: boolean
} {
  let task: string | null = null
  let workspaceRoot = process.cwd()
  let maxTokens = 80000
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === "--workspace" || arg === "-w") {
      workspaceRoot = args[++i] ?? process.cwd()
    } else if (arg === "--max-tokens") {
      const n = parseInt(args[++i] ?? "80000", 10)
      if (!isNaN(n)) maxTokens = n
    } else if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(USAGE + "\n")
      process.exit(0)
    } else if (!arg.startsWith("-") && task === null) {
      task = arg
    }
  }

  return { task, workspaceRoot, maxTokens, dryRun }
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk)
  }
  const bytes = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return new TextDecoder().decode(bytes).trim()
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const { task: argTask, workspaceRoot, maxTokens, dryRun } = parseArgs(args)

  let task = argTask

  // Read from stdin if no task argument and stdin is piped
  if (!task) {
    const isTTY = Bun.stdin.fd !== -1 && process.stdin.isTTY
    if (isTTY) {
      process.stdout.write(USAGE + "\n")
      process.exit(0)
    }
    task = await readStdin()
  }

  if (!task) {
    process.stdout.write(USAGE + "\n")
    process.exit(0)
  }

  // Handle SIGINT gracefully
  process.on("SIGINT", () => {
    process.stdout.write("\n[interrupted]\n")
    process.exit(0)
  })

  await runAgent(task, workspaceRoot, { maxTokens, dryRun })
}

main().catch((err) => {
  process.stderr.write(`[error] ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
