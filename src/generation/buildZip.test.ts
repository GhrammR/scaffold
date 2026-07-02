import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildScaffoldZip } from './buildZip'

describe('buildScaffoldZip', () => {
  it('produces a zip blob containing every file in the tree at its path', async () => {
    const fileTree = {
      'CLAUDE.md': '# CLAUDE.md\n\n@AGENTS.md\n',
      'AGENTS.md': '# AGENTS.md\n\nA recipe app.\n',
      'slice-plan.md': '# Slice Plan\n\n1. **Slice 1**\n   Do the thing.\n',
    }

    const blob = await buildScaffoldZip(fileTree)
    expect(blob).toBeInstanceOf(Blob)

    const zip = await JSZip.loadAsync(blob)
    const fileNames = Object.keys(zip.files)
    expect(fileNames).toEqual(expect.arrayContaining(['CLAUDE.md', 'AGENTS.md', 'slice-plan.md']))
    expect(fileNames).toHaveLength(3)

    const agentsMdEntry = await zip.file('AGENTS.md')?.async('string')
    expect(agentsMdEntry).toBe(fileTree['AGENTS.md'])
  })

  it('correctly nests a file whose path contains slashes into folders', async () => {
    const fileTree = {
      '.agent_governance/README.md': '# .agent_governance/\n',
      '.agent_governance/rules/no-payment-storage.md': '# Rule\n\nNever store payment details.\n',
      'CLAUDE.md': '# CLAUDE.md\n',
    }

    const blob = await buildScaffoldZip(fileTree)
    const zip = await JSZip.loadAsync(blob)

    // JSZip creates folder entries automatically for slash-containing paths.
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        '.agent_governance/',
        '.agent_governance/README.md',
        '.agent_governance/rules/',
        '.agent_governance/rules/no-payment-storage.md',
        'CLAUDE.md',
      ]),
    )

    const ruleFile = await zip.file('.agent_governance/rules/no-payment-storage.md')?.async('string')
    expect(ruleFile).toBe(fileTree['.agent_governance/rules/no-payment-storage.md'])
  })
})
