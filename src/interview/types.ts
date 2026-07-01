export type CoverageStatusValue = 'open' | 'covered' | 'soft' | 'n/a'

export interface CoverageStatus {
  areaId: string
  label: string
  status: CoverageStatusValue
  note?: string
}

export type DecisionKind = 'hard' | 'soft'

export interface Decision {
  id: string
  area: string
  summary: string
  kind: DecisionKind
}

export interface InterviewTurn {
  message: string
  coverage: CoverageStatus[]
  decisions: Decision[]
  readyToGenerate: boolean
  doneWarning?: string
}
