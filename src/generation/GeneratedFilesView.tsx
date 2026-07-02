import { useState } from 'react'
import type { useGeneration } from './useGeneration'
import { buildScaffoldZip } from './buildZip'

interface GeneratedFilesViewProps {
  generation: ReturnType<typeof useGeneration>
  onBackToInterview: () => void
}

function FilePanel({ filename, content }: { filename: string; content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border rounded flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <span className="font-mono text-sm font-semibold">{filename}</span>
        <button type="button" onClick={handleCopy} className="text-xs underline">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-auto text-sm whitespace-pre-wrap flex-1">{content}</pre>
    </div>
  )
}

export function GeneratedFilesView({ generation, onBackToInterview }: GeneratedFilesViewProps) {
  const { state, generate, dismissError } = generation
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const handleDownload = async () => {
    if (!state.claudeMdText || !state.slicePlanText) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const blob = await buildScaffoldZip(state.claudeMdText, state.slicePlanText)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'scaffold.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[download] Failed to build the scaffold zip:', error)
      setDownloadError('Failed to build the download. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Generated scaffold</h1>
        <div className="flex gap-2">
          <button type="button" onClick={onBackToInterview} className="text-sm underline">
            Back to interview
          </button>
          <button type="button" onClick={generate} disabled={state.status === 'loading'} className="text-sm underline">
            Regenerate
          </button>
          {state.status === 'done' && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >
              {downloading ? 'Zipping…' : 'Download scaffold'}
            </button>
          )}
        </div>
      </div>

      {state.status === 'loading' && <p className="text-gray-400 text-sm">Generating…</p>}

      {downloadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between">
          <span className="text-sm text-red-700">{downloadError}</span>
          <button type="button" onClick={() => setDownloadError(null)} className="text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      {state.errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between">
          <span className="text-sm text-red-700">{state.errorMessage}</span>
          <div className="flex gap-2">
            <button type="button" onClick={generate} className="text-sm underline">
              Retry
            </button>
            <button type="button" onClick={dismissError} className="text-sm underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {state.status === 'done' && state.claudeMdText && state.slicePlanText && (
        <div className="flex-1 flex gap-4 min-h-0">
          <FilePanel filename="CLAUDE.md" content={state.claudeMdText} />
          <FilePanel filename="slice-plan.md" content={state.slicePlanText} />
        </div>
      )}
    </div>
  )
}
