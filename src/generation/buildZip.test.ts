import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildScaffoldZip, scaffoldFiles } from './buildZip'

describe('scaffoldFiles', () => {
  it('maps the rendered markdown to CLAUDE.md and slice-plan.md at the root', () => {
    const files = scaffoldFiles('# CLAUDE.md\n\ncontent', '# Slice Plan\n\ncontent')
    expect(files).toEqual([
      { path: 'CLAUDE.md', content: '# CLAUDE.md\n\ncontent' },
      { path: 'slice-plan.md', content: '# Slice Plan\n\ncontent' },
    ])
  })
})

describe('buildScaffoldZip', () => {
  it('produces a zip blob containing both files with the expected paths and content', async () => {
    const claudeMdText = '# CLAUDE.md\n\n## 1. Project Summary\n\nA recipe app.\n'
    const slicePlanText = '# Slice Plan\n\n1. **Slice 1**\n   Do the thing.\n'

    const blob = await buildScaffoldZip(claudeMdText, slicePlanText)
    expect(blob).toBeInstanceOf(Blob)

    const zip = await JSZip.loadAsync(blob)
    const fileNames = Object.keys(zip.files)
    expect(fileNames).toEqual(expect.arrayContaining(['CLAUDE.md', 'slice-plan.md']))
    expect(fileNames).toHaveLength(2)

    const claudeMdEntry = await zip.file('CLAUDE.md')?.async('string')
    const slicePlanEntry = await zip.file('slice-plan.md')?.async('string')
    expect(claudeMdEntry).toBe(claudeMdText)
    expect(slicePlanEntry).toBe(slicePlanText)
  })
})
