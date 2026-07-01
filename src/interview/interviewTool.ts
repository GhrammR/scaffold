import type { ToolDefinition } from '../llm/LLMProvider'

export const INTERVIEW_TOOL_NAME = 'interview_turn'

export const INTERVIEW_TOOL: ToolDefinition = {
  name: INTERVIEW_TOOL_NAME,
  description:
    'Report the current interview turn: the message to show the user, a full snapshot of coverage status, a full snapshot of the settled decisions log, and whether the interview is ready to move to generation.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The conversational text to show the user for this turn.',
      },
      coverage: {
        type: 'array',
        description: 'Full current snapshot of every coverage area (baseline plus any you added).',
        items: {
          type: 'object',
          properties: {
            areaId: { type: 'string' },
            label: { type: 'string' },
            status: { type: 'string', enum: ['open', 'covered', 'soft', 'n/a'] },
            note: { type: 'string' },
          },
          required: ['areaId', 'label', 'status'],
        },
      },
      decisions: {
        type: 'array',
        description: 'Full current snapshot of every settled decision.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            area: { type: 'string' },
            summary: { type: 'string' },
            kind: { type: 'string', enum: ['hard', 'soft'] },
          },
          required: ['id', 'area', 'summary', 'kind'],
        },
      },
      readyToGenerate: {
        type: 'boolean',
        description: 'True once all relevant coverage areas are covered/soft/n-a and you are proposing to generate.',
      },
      doneWarning: {
        type: 'string',
        description:
          'Set only when the user asked to stop early and coverage is incomplete: name what is still unresolved.',
      },
    },
    required: ['message', 'coverage', 'decisions', 'readyToGenerate'],
  },
}
