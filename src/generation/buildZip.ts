import JSZip from 'jszip'

export interface ScaffoldFile {
  path: string
  content: string
}

export function scaffoldFiles(claudeMdText: string, slicePlanText: string): ScaffoldFile[] {
  return [
    { path: 'CLAUDE.md', content: claudeMdText },
    { path: 'slice-plan.md', content: slicePlanText },
  ]
}

export async function buildScaffoldZip(claudeMdText: string, slicePlanText: string): Promise<Blob> {
  const zip = new JSZip()
  for (const file of scaffoldFiles(claudeMdText, slicePlanText)) {
    zip.file(file.path, file.content)
  }
  return zip.generateAsync({ type: 'blob' })
}
