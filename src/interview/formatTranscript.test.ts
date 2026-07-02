import { describe, expect, it } from 'vitest'
import { formatTranscript } from './formatTranscript'

describe('formatTranscript', () => {
  it('labels user and AI turns and separates them with a blank line', () => {
    const result = formatTranscript([
      { role: 'user', content: 'A recipe app' },
      { role: 'assistant', content: 'What features does it need?' },
    ])
    expect(result).toBe('User: A recipe app\n\nAI: What features does it need?')
  })

  it('returns an empty string for no messages', () => {
    expect(formatTranscript([])).toBe('')
  })
})
