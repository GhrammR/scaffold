import { describe, expect, it } from 'vitest'
import { buildRegenerateWithRevisionsSystemPrompt } from './regenerateWithRevisionsSystemPrompt'
import { buildGenerationSystemPrompt } from './generationSystemPrompt'

describe('buildRegenerateWithRevisionsSystemPrompt', () => {
  it('returns exactly the base generation prompt when there are no revision requests', () => {
    const prompt = buildRegenerateWithRevisionsSystemPrompt([], [], [])
    expect(prompt).toBe(buildGenerationSystemPrompt([], []))
  })

  it('includes the base generation prompt plus a listed, numbered section of revision requests', () => {
    const prompt = buildRegenerateWithRevisionsSystemPrompt(
      [],
      [],
      ['Add a hard rule that tests run before every commit.', 'Make the styling decision hard, not soft.'],
    )
    expect(prompt).toContain(buildGenerationSystemPrompt([], []))
    expect(prompt).toContain('1. Add a hard rule that tests run before every commit.')
    expect(prompt).toContain('2. Make the styling decision hard, not soft.')
    expect(prompt).toContain('FULL REGENERATION')
  })
})
