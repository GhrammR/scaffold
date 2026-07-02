import JSZip from 'jszip'

export async function buildScaffoldZip(fileTree: Record<string, string>): Promise<Blob> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(fileTree)) {
    zip.file(path, content)
  }
  return zip.generateAsync({ type: 'blob' })
}
