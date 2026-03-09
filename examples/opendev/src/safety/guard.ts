import { resolve } from "path"

const HARD_BLOCKED_PATTERNS: Array<{ pattern: RegExp | string; reason: string }> = [
  { pattern: /rm\s+-rf\s+\/(?:\s|$)/, reason: "Destructive: rm -rf /" },
  { pattern: /sudo\s+rm/, reason: "Destructive: sudo rm" },
  { pattern: />[\s]*\/dev\//, reason: "Dangerous: redirecting to /dev/" },
  { pattern: /\bmkfs\b/, reason: "Destructive: mkfs (filesystem format)" },
  { pattern: /\bdd\s+if=/, reason: "Destructive: dd if= (disk write)" },
  { pattern: /:\(\)\s*\{[\s\S]*:\s*\|[\s\S]*:[\s\S]*&[\s\S]*\}[\s\S]*:/, reason: "Fork bomb detected" },
]

const WARN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bsudo\b/, reason: "Command uses sudo" },
  { pattern: /chmod\s+777/, reason: "Setting world-writable permissions (chmod 777)" },
  { pattern: /curl[^|]+\|\s*bash/, reason: "Piping curl output to bash" },
]

export function validateCommand(
  command: string,
  workspaceRoot: string
): { allowed: boolean; reason?: string } {
  // Check hard-blocked patterns
  for (const { pattern, reason } of HARD_BLOCKED_PATTERNS) {
    const matched =
      pattern instanceof RegExp ? pattern.test(command) : command.includes(pattern)
    if (matched) {
      process.stderr.write(`[safety] BLOCKED command: "${command}" — ${reason}\n`)
      return { allowed: false, reason }
    }
  }

  // Check for path traversal outside workspaceRoot
  const pathMatches = command.match(/(?:^|\s)(\/[^\s]+)/g)
  if (pathMatches) {
    const resolvedRoot = resolve(workspaceRoot)
    for (const rawPath of pathMatches) {
      const trimmed = rawPath.trim()
      const resolvedPath = resolve(trimmed)
      if (!resolvedPath.startsWith(resolvedRoot) && resolvedPath !== resolvedRoot) {
        // Only block absolute paths that clearly resolve outside workspace
        // Allow common system paths like /usr/bin, /bin, etc.
        const systemPaths = ["/usr", "/bin", "/etc", "/tmp", "/var", "/opt", "/home"]
        const isSystemPath = systemPaths.some((p) => resolvedPath.startsWith(p))
        if (!isSystemPath) {
          const reason = `Path resolves outside workspace: ${trimmed}`
          process.stderr.write(`[safety] BLOCKED command: "${command}" — ${reason}\n`)
          return { allowed: false, reason }
        }
      }
    }
  }

  // Warn but allow certain patterns
  for (const { pattern, reason } of WARN_PATTERNS) {
    if (pattern.test(command)) {
      process.stderr.write(`[safety] WARNING: "${command}" — ${reason}\n`)
    }
  }

  return { allowed: true }
}
