import { useState } from 'react'
import type { useGeneration } from './useGeneration'

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
        </div>
      </div>

      {state.status === 'loading' && <p className="text-gray-400 text-sm">Generating…</p>}

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
