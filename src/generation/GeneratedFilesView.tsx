import { useState } from 'react'
import type { HistoryLineage, RevisionHistoryEntry, useGeneration } from './useGeneration'
import { buildScaffoldZip } from './buildZip'
import { countDiffTotals, type KeyedListDiff, type ListDiff, type ScaffoldDiffSummary } from './diffScaffold'
import { countLineDiff, diffLines, type LineDiffOp } from './lineDiff'
import { groupDiffTotalsByFile } from './diffFileGrouping'
import { computeNamedFileDiffs } from './revisionFileDiffs'

interface GeneratedFilesViewProps {
  generation: ReturnType<typeof useGeneration>
  onBackToInterview: () => void
}

function CountBadge({ added, removed }: { added: number; removed: number }) {
  if (added === 0 && removed === 0) return null
  return (
    <span className="text-xs font-mono">
      {removed > 0 && <span className="text-red-600">-{removed} </span>}
      {added > 0 && <span className="text-green-700">+{added}</span>}
    </span>
  )
}

function FileLines({ ops }: { ops: LineDiffOp[] }) {
  return (
    <div className="font-mono text-sm">
      {ops.map((op, i) => (
        <div
          key={i}
          className={
            'whitespace-pre-wrap px-1 ' +
            (op.type === 'removed'
              ? 'bg-red-50 text-red-700'
              : op.type === 'added'
                ? 'bg-green-50 text-green-800'
                : '')
          }
        >
          {op.type === 'removed' ? '− ' : op.type === 'added' ? '+ ' : '  '}
          {op.line}
        </div>
      ))}
    </div>
  )
}

function FilePanel({
  filename,
  content,
  diffOps,
}: {
  filename: string
  content: string
  diffOps?: LineDiffOp[]
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border rounded flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">{filename}</span>
          {diffOps && <CountBadge {...countLineDiff(diffOps)} />}
        </span>
        <button type="button" onClick={handleCopy} className="text-xs underline">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="p-3 overflow-auto flex-1">
        {diffOps ? <FileLines ops={diffOps} /> : <pre className="text-sm whitespace-pre-wrap">{content}</pre>}
      </div>
    </div>
  )
}

function ListDiffLines({ diff }: { diff: ListDiff }) {
  return (
    <>
      {diff.removed.map((item, i) => (
        <div key={`removed-${i}`} className="text-red-600 line-through decoration-red-400">
          − {item}
        </div>
      ))}
      {diff.added.map((item, i) => (
        <div key={`added-${i}`} className="text-green-700">
          + {item}
        </div>
      ))}
    </>
  )
}

function KeyedListDiffLines({ diff }: { diff: KeyedListDiff }) {
  return (
    <>
      {diff.removed.map((key, i) => (
        <div key={`removed-${i}`} className="text-red-600 line-through decoration-red-400">
          − {key}
        </div>
      ))}
      {diff.modified.map((key, i) => (
        <div key={`modified-${i}`} className="text-amber-600">
          ~ {key}
        </div>
      ))}
      {diff.added.map((key, i) => (
        <div key={`added-${i}`} className="text-green-700">
          + {key}
        </div>
      ))}
    </>
  )
}

function hasListChanges(diff: ListDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0
}

function hasKeyedChanges(diff: KeyedListDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0
}

// Field-level rows grouped by which generated file they land in — mirrors the
// per-file structure shown at the top of the file panels.
function DiffDetail({ diff }: { diff: ScaffoldDiffSummary }) {
  const claudeMdRows: { label: string; content: React.ReactNode }[] = []
  const slicePlanRows: { label: string; content: React.ReactNode }[] = []

  if (diff.projectSummaryChanged) claudeMdRows.push({ label: 'Project Summary', content: <div className="text-amber-600">~ changed</div> })
  if (diff.stackArchitectureChanged) claudeMdRows.push({ label: 'Stack & Architecture', content: <div className="text-amber-600">~ changed</div> })
  if (hasListChanges(diff.hardInvariants)) claudeMdRows.push({ label: 'Hard Invariants', content: <ListDiffLines diff={diff.hardInvariants} /> })
  if (hasKeyedChanges(diff.softDecisions)) claudeMdRows.push({ label: 'Soft Decisions', content: <KeyedListDiffLines diff={diff.softDecisions} /> })
  if (hasKeyedChanges(diff.knownForks)) claudeMdRows.push({ label: 'Known Forks', content: <KeyedListDiffLines diff={diff.knownForks} /> })
  if (hasListChanges(diff.conventions)) claudeMdRows.push({ label: 'Conventions', content: <ListDiffLines diff={diff.conventions} /> })
  if (hasKeyedChanges(diff.slices)) slicePlanRows.push({ label: 'Slice Plan', content: <KeyedListDiffLines diff={diff.slices} /> })

  const totalsByFile = groupDiffTotalsByFile(diff)
  const groups = [
    { filename: 'CLAUDE.md', rows: claudeMdRows },
    { filename: 'slice-plan.md', rows: slicePlanRows },
  ]
    .map((g) => ({ ...g, totals: totalsByFile.find((f) => f.filename === g.filename) }))
    .filter((g) => g.rows.length > 0)

  if (groups.length === 0) {
    return <div className="text-sm text-gray-500">No changes.</div>
  }

  return (
    <div className="space-y-3 text-sm">
      {groups.map((group) => (
        <div key={group.filename}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans font-semibold text-gray-800">{group.filename}</span>
            {group.totals && <CountBadge added={group.totals.added} removed={group.totals.removed} />}
          </div>
          <div className="space-y-2 font-mono pl-2">
            {group.rows.map((row) => (
              <div key={row.label}>
                <div className="font-sans font-semibold text-gray-700">{row.label}</div>
                {row.content}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CollapsibleDiffDetail({ diff }: { diff: ScaffoldDiffSummary }) {
  const [expanded, setExpanded] = useState(true)
  const totals = countDiffTotals(diff)

  return (
    <div className="bg-blue-50 border border-blue-200 rounded flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between gap-2 w-full text-left p-3"
      >
        <span className="flex items-center gap-1 text-sm font-semibold text-blue-800">
          <span className="text-blue-400">{expanded ? '▾' : '▸'}</span>
          <span>What changed (detail)</span>
        </span>
        <CountBadge added={totals.added} removed={totals.removed} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 max-h-[40vh] overflow-y-auto">
          <DiffDetail diff={diff} />
        </div>
      )}
    </div>
  )
}

interface TwoFileTexts {
  previousClaudeMdText: string
  nextClaudeMdText: string
  previousSlicePlanText: string
  nextSlicePlanText: string
}

function namedFileDiffsFor(texts: TwoFileTexts) {
  return computeNamedFileDiffs([
    { filename: 'CLAUDE.md', previous: texts.previousClaudeMdText, next: texts.nextClaudeMdText },
    { filename: 'slice-plan.md', previous: texts.previousSlicePlanText, next: texts.nextSlicePlanText },
  ])
}

function ExpandableFileDiffs({ fileDiffs }: { fileDiffs: ReturnType<typeof computeNamedFileDiffs> }) {
  if (fileDiffs.length === 0) {
    return <div className="text-gray-400">No file changes.</div>
  }
  return (
    <>
      {fileDiffs.map((file) => (
        <div key={file.filename}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono font-semibold text-gray-700">{file.filename}</span>
            <CountBadge added={file.added} removed={file.removed} />
          </div>
          <FileLines ops={file.ops} />
        </div>
      ))}
    </>
  )
}

function RevisionHistoryItem({ entry }: { entry: RevisionHistoryEntry }) {
  const [expanded, setExpanded] = useState(false)
  const fileDiffs = namedFileDiffsFor(entry)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between gap-2 w-full text-left"
      >
        <span className="flex items-center gap-1">
          <span className="text-gray-400">{expanded ? '▾' : '▸'}</span>
          <span>{entry.request}</span>
        </span>
        <CountBadge
          added={fileDiffs.reduce((sum, f) => sum + f.added, 0)}
          removed={fileDiffs.reduce((sum, f) => sum + f.removed, 0)}
        />
      </button>

      {expanded && (
        <div className="mt-2 mb-1 ml-4 space-y-2 border-l pl-3">
          <ExpandableFileDiffs fileDiffs={fileDiffs} />
        </div>
      )}
    </div>
  )
}

const REGENERATION_LABEL: Record<HistoryLineage['regeneration']['kind'], string> = {
  fresh: 'Regeneration',
  'with-revisions': 'Regeneration (with revisions)',
}

function LineageItem({ lineage }: { lineage: HistoryLineage }) {
  const [expanded, setExpanded] = useState(false)
  const fileDiffs = namedFileDiffsFor(lineage.regeneration)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between gap-2 w-full text-left font-semibold text-gray-700"
      >
        <span className="flex items-center gap-1">
          <span className="text-gray-400">{expanded ? '▾' : '▸'}</span>
          <span>{REGENERATION_LABEL[lineage.regeneration.kind]}</span>
        </span>
        <CountBadge
          added={fileDiffs.reduce((sum, f) => sum + f.added, 0)}
          removed={fileDiffs.reduce((sum, f) => sum + f.removed, 0)}
        />
      </button>

      {expanded && (
        <div className="mt-2 mb-1 ml-4 space-y-3 border-l pl-3">
          <div className="space-y-2">
            <ExpandableFileDiffs fileDiffs={fileDiffs} />
          </div>
          {lineage.revisions.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-gray-500">Revisions leading up to this regeneration</div>
              {lineage.revisions.map((entry, i) => (
                <RevisionHistoryItem key={i} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function GeneratedFilesView({ generation, onBackToInterview }: GeneratedFilesViewProps) {
  const { state, generate, regenerateWithRevisions, revise, dismissError } = generation
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [revisionDraft, setRevisionDraft] = useState('')

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

  // The most recent action drives the diff display: an open revision if one
  // exists since the last regeneration, else the most recent regeneration's
  // own diff, else nothing (fresh first generation, no "previous" yet).
  const latestAction: TwoFileTexts | undefined =
    state.openRevisions.at(-1) ?? state.lineages.at(-1)?.regeneration
  const claudeMdDiffOps = latestAction ? diffLines(latestAction.previousClaudeMdText, latestAction.nextClaudeMdText) : undefined
  const slicePlanDiffOps = latestAction
    ? diffLines(latestAction.previousSlicePlanText, latestAction.nextSlicePlanText)
    : undefined
  const latestActionDiff = state.openRevisions.at(-1)?.diff ?? state.lineages.at(-1)?.regeneration.diff
  const hasAnyRevisions = state.lineages.some((l) => l.revisions.length > 0) || state.openRevisions.length > 0

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Generated scaffold</h1>
        <div className="flex gap-2">
          <button type="button" onClick={onBackToInterview} className="text-sm underline">
            Back to interview
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                hasAnyRevisions &&
                !window.confirm('This will discard all revisions and history and regenerate from scratch. Continue?')
              ) {
                return
              }
              generate()
            }}
            disabled={state.status === 'loading'}
            className="text-sm underline"
          >
            Regenerate
          </button>
          {hasAnyRevisions && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('This will replace the current scaffold with a fresh regeneration (your revision history is kept). Continue?')) {
                  return
                }
                regenerateWithRevisions()
              }}
              disabled={state.status === 'loading'}
              className="text-sm underline"
            >
              Regenerate with revisions
            </button>
          )}
          {state.claudeMdText && state.slicePlanText && (
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

      {state.status === 'loading' && <p className="text-gray-400 text-sm">Working…</p>}

      {state.noOpWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          {state.noOpWarning}
        </div>
      )}

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

      {/* Level 1 (per-file badges) + Level 2 (inline red/green lines in place) */}
      {state.claudeMdText && state.slicePlanText && (
        <div className="flex-1 flex gap-4 min-h-0">
          <FilePanel filename="CLAUDE.md" content={state.claudeMdText} diffOps={claudeMdDiffOps} />
          <FilePanel filename="slice-plan.md" content={state.slicePlanText} diffOps={slicePlanDiffOps} />
        </div>
      )}

      {/* Level 3: detailed per-section breakdown, grouped by file, below the files.
          Bounded + scrollable so a large diff scrolls within its own area
          instead of growing the page and pushing the file panels off-screen. */}
      {latestActionDiff && <CollapsibleDiffDetail diff={latestActionDiff} />}

      {state.scaffold && (
        <div className="border rounded p-3 flex flex-col gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!revisionDraft.trim() || state.status === 'loading') return
              revise(revisionDraft.trim())
              setRevisionDraft('')
            }}
            className="flex gap-2"
          >
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              value={revisionDraft}
              onChange={(e) => setRevisionDraft(e.target.value)}
              placeholder="Ask for a change — e.g. add a hard rule that tests run before every commit…"
              disabled={state.status === 'loading'}
            />
            <button
              type="submit"
              disabled={state.status === 'loading'}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              Revise
            </button>
          </form>

          {hasAnyRevisions && (
            <div className="text-xs text-gray-500 space-y-2">
              <div className="font-semibold">Revision history</div>
              {state.openRevisions
                .slice()
                .reverse()
                .map((entry, i) => (
                  <RevisionHistoryItem key={`open-${i}`} entry={entry} />
                ))}
              {state.lineages
                .slice()
                .reverse()
                .map((lineage, i) => (
                  <LineageItem key={`lineage-${i}`} lineage={lineage} />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
