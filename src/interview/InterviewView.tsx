import { useState } from 'react'
import type { useInterview } from './useInterview'

interface InterviewViewProps {
  interview: ReturnType<typeof useInterview>
}

export function InterviewView({ interview }: InterviewViewProps) {
  const { state, start, sendMessage, requestStopEarly, dismissError, retry, startOver } = interview
  const [draft, setDraft] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    if (!state.started) {
      start(draft.trim())
    } else {
      sendMessage(draft.trim())
    }
    setDraft('')
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Coverage</h2>
          <button type="button" onClick={startOver} className="text-xs text-gray-500 underline">
            Start over
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          {state.coverage.map((c) => (
            <li key={c.areaId} className="flex items-start gap-2">
              <span
                className={
                  c.status === 'covered'
                    ? 'text-green-600'
                    : c.status === 'soft'
                      ? 'text-amber-600'
                      : c.status === 'n/a'
                        ? 'text-gray-400'
                        : 'text-gray-400'
                }
              >
                {c.status === 'covered' ? '●' : c.status === 'soft' ? '◐' : c.status === 'n/a' ? '—' : '○'}
              </span>
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!state.started && (
            <p className="text-gray-500">Describe the project you want to build to start the interview.</p>
          )}
          {state.messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={
                  'inline-block rounded px-3 py-2 max-w-lg ' +
                  (m.role === 'user' ? 'bg-blue-100' : 'bg-gray-100')
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {state.status === 'loading' && <p className="text-gray-400 text-sm">Thinking…</p>}
        </div>

        {state.errorMessage && (
          <div className="p-3 bg-red-50 border-t border-red-200 flex items-center justify-between">
            <span className="text-sm text-red-700">{state.errorMessage}</span>
            <div className="flex gap-2">
              <button type="button" onClick={retry} className="text-sm underline">
                Retry
              </button>
              <button type="button" onClick={dismissError} className="text-sm underline">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {state.readyToGenerate && (
          <div className="p-3 bg-green-50 border-t border-green-200 text-sm text-green-800">
            Ready to generate — this slice doesn't build files yet, but the interview thinks it has enough.
          </div>
        )}

        {state.doneWarning && (
          <div className="p-3 bg-amber-50 border-t border-amber-200 text-sm text-amber-800">
            {state.doneWarning}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={state.started ? 'Type your answer…' : 'Describe the project you want to build…'}
            disabled={state.status === 'loading'}
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={state.status === 'loading'}>
            Send
          </button>
          {state.started && (
            <button
              type="button"
              onClick={requestStopEarly}
              disabled={state.status === 'loading'}
              className="px-4 py-2 border rounded"
            >
              I think I'm done
            </button>
          )}
        </form>
      </main>
    </div>
  )
}
