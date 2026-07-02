import { describe, expect, it } from 'vitest'
import { buildRevisionSystemPrompt } from './revisionSystemPrompt'
import type { GeneratedScaffold } from './types'

const scaffold: GeneratedScaffold = {
  claudeMd: {
    projectSummary: 'A calculator app.',
    stackArchitecture: 'React + TypeScript.',
    hardInvariants: ['Divide by zero must show an error.'],
    softDecisions: [],
    knownForks: [],
    conventions: [],
  },
  slicePlan: { slices: [] },
}

describe('buildRevisionSystemPrompt', () => {
  it('embeds the current scaffold as ground truth', () => {
    const prompt = buildRevisionSystemPrompt(scaffold)
    expect(prompt).toContain('Divide by zero must show an error.')
  })

  it('instructs the model to keep a same-item replacement at its original list position', () => {
    const prompt = buildRevisionSystemPrompt(scaffold)
    expect(prompt).toContain('SAME POSITION in the list')
    expect(prompt).toContain('do not remove it and append the new one at the end')
  })
})
