import type { LLMMessage } from '../llm/LLMProvider'

export function formatTranscript(messages: LLMMessage[]): string {
  return messages.map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n\n')
}
