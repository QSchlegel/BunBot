# opendev — Autonomous CLI Coding Agent

An OpenDev-like autonomous CLI coding agent built with Bun, TypeScript, and multi-provider LLM support.

## Features

- **Dual-agent architecture**: Planner + Executor agents
- **Multi-provider LLM**: Anthropic, OpenAI, OpenRouter — switchable via env vars
- **Lazy tool registry**: Tools loaded on-demand
- **Adaptive context compaction**: Automatically summarizes history when context grows large
- **Safety guard**: Blocks destructive shell commands
- **Bun-native**: Uses `Bun.$`, `Bun.file`, `Bun.write` — no Node.js APIs

## Usage

```bash
# Run a task
bun run src/index.ts "fix the failing tests"

# Pipe task from stdin
echo "add error handling to api.ts" | bun run src/index.ts

# Plan only (no execution)
bun run src/index.ts "refactor auth module" --workspace ./src --dry-run

# Compile to single binary
bun build src/index.ts --compile --outfile opendev
./opendev "list all TypeScript files" --dry-run
```

## Configuration

Set environment variables to configure LLM providers:

```bash
# Provider API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...

# Model selection (provider auto-detected from model name prefix)
PLANNER_MODEL=claude-opus-4-5          # claude-* → Anthropic
EXECUTOR_MODEL=claude-haiku-4-5-20251001
COMPACT_MODEL=gpt-4o-mini              # gpt-*, o1-*, o3-* → OpenAI
                                        # anything else → OpenRouter
```

## Architecture

```
CLI (src/index.ts)
  └── runAgent (src/agent/loop.ts)
        ├── plan() → Planner LLM → step list
        └── for each step:
              ├── executeStep() → Executor LLM → tool calls
              │     └── Tool Registry (lazy load)
              │           ├── shell   — Bun.$ with safety guard
              │           ├── file_read — Bun.file().text()
              │           ├── file_write — Bun.write()
              │           └── search  — grep via Bun.$
              └── compact() if context > 80% full
```

## Running Tests

```bash
bun test
```

5 smoke tests covering: safety guard, file I/O, context compaction, tool lazy-loading.
