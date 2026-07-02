export interface SoftDecisionEntry {
  decision: string
  reason: string
}

export interface KnownForkEntry {
  fork: string
  consideration: string
}

export interface ClaudeMdContent {
  projectSummary: string
  stackArchitecture: string
  hardInvariants: string[]
  softDecisions: SoftDecisionEntry[]
  knownForks: KnownForkEntry[]
  conventions: string[]
}

export interface SliceEntry {
  title: string
  description: string
}

export interface SlicePlanContent {
  slices: SliceEntry[]
}

export interface GeneratedScaffold {
  claudeMd: ClaudeMdContent
  slicePlan: SlicePlanContent
}
