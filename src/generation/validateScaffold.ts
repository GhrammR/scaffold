import type { Decision } from '../interview/types'
import type { GeneratedScaffold } from './types'

export function validateScaffold(scaffold: GeneratedScaffold, decisions: Decision[]): string[] {
  const problems: string[] = []
  const { claudeMd, slicePlan } = scaffold

  if (!claudeMd.projectSummary.trim()) problems.push('projectSummary is empty.')
  if (!claudeMd.stackArchitecture.trim()) problems.push('stackArchitecture is empty.')

  const hardDecisions = decisions.filter((d) => d.kind === 'hard')
  if (hardDecisions.length > 0 && claudeMd.hardInvariants.length === 0) {
    problems.push(
      `hardInvariants is empty even though these hard decisions were established: ${hardDecisions
        .map((d) => d.summary)
        .join('; ')}.`,
    )
  }

  const softDecisionsLog = decisions.filter((d) => d.kind === 'soft')
  if (softDecisionsLog.length > 0 && claudeMd.softDecisions.length === 0) {
    problems.push(
      `softDecisions is empty even though these soft decisions were established: ${softDecisionsLog
        .map((d) => d.summary)
        .join('; ')}.`,
    )
  }

  if (claudeMd.softDecisions.some((d) => !d.reason.trim())) {
    problems.push('At least one softDecisions entry is missing a reason.')
  }

  if (claudeMd.hardInvariants.some((e) => !e.title.trim() || !e.content.trim())) {
    problems.push('At least one hardInvariants entry is missing a title or content.')
  }

  if (claudeMd.softDecisions.some((d) => !d.title.trim())) {
    problems.push('At least one softDecisions entry is missing a title.')
  }

  if (slicePlan.slices.length === 0) {
    problems.push('slicePlan has no slices.')
  }

  return problems
}
