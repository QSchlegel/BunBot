import type { Message } from "../types.ts"

const COMPACTION_THRESHOLD = 0.8

export class ContextWindow {
  messages: Message[] = []
  maxTokens: number

  constructor(maxTokens = 80000) {
    this.maxTokens = maxTokens
  }

  addMessage(msg: Message): void {
    this.messages.push(msg)
  }

  getMessages(): Message[] {
    return this.messages
  }

  getTokenCount(): number {
    const totalChars = this.messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.ceil(totalChars / 4)
  }

  getBudgetPercent(): number {
    return (this.getTokenCount() / this.maxTokens) * 100
  }

  needsCompaction(): boolean {
    return this.getBudgetPercent() > COMPACTION_THRESHOLD * 100
  }

  clear(): void {
    this.messages = []
  }
}
