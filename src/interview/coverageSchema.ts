export interface CoverageArea {
  id: string
  label: string
  satisfiedWhen: string
}

export const BASELINE_COVERAGE_AREAS: CoverageArea[] = [
  {
    id: 'project-summary',
    label: 'Project summary',
    satisfiedWhen: 'What is being built, who it is for, and why it matters is established.',
  },
  {
    id: 'stack-architecture',
    label: 'Stack & architecture',
    satisfiedWhen:
      'Language/framework, hosting model, client-vs-server split, and data storage approach are established (or explicitly deferred as soft).',
  },
  {
    id: 'structure',
    label: 'Screens / modes / structure',
    satisfiedWhen:
      'Whether the project has multiple distinct screens/modes/features is established, and if so, whether they are a flat list or a structured hierarchy, and how they connect. Mark n/a if the project has no such structure (e.g. a single-purpose CLI or library).',
  },
  {
    id: 'hard-invariants',
    label: 'Hard invariants',
    satisfiedWhen:
      'The things that must never break — security rules, compliance constraints, business rules the user is confident about — are captured as HARD decisions.',
  },
  {
    id: 'out-of-scope',
    label: 'Explicit out-of-scope',
    satisfiedWhen: 'What will NOT be built in the first version is explicitly named, not just implied.',
  },
  {
    id: 'forks-weak-spots',
    label: 'Known forks / weak spots',
    satisfiedWhen:
      'Ambiguous decisions with multiple viable approaches, integration boundaries, or rework-risk choices specific to this project have been actively surfaced and either settled or marked soft.',
  },
  {
    id: 'conventions',
    label: 'Conventions',
    satisfiedWhen: 'Code style, testing expectations, and naming/file-organization preferences are established (or explicitly deferred as soft).',
  },
]
