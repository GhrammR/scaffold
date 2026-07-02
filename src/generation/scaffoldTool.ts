import type { ToolDefinition } from '../llm/LLMProvider'

export const SCAFFOLD_TOOL_NAME = 'generate_scaffold'

export const SCAFFOLD_TOOL: ToolDefinition = {
  name: SCAFFOLD_TOOL_NAME,
  description:
    'Report the generated scaffold: structured content for CLAUDE.md (7 sections) and slice-plan.md, derived from the completed interview. Never include markdown syntax — provide plain content per field; the app renders formatting.',
  inputSchema: {
    type: 'object',
    properties: {
      claudeMd: {
        type: 'object',
        properties: {
          projectSummary: { type: 'string', description: 'What is being built, for whom, and why. Plain prose.' },
          stackArchitecture: { type: 'string', description: 'Stack and architecture decisions. Plain prose.' },
          hardInvariants: {
            type: 'array',
            description: 'Each a discrete never-break rule, drawn from decisions tagged hard.',
            items: { type: 'string' },
          },
          softDecisions: {
            type: 'array',
            description: 'Each a decision tagged soft, with why it is provisional.',
            items: {
              type: 'object',
              properties: {
                decision: { type: 'string' },
                reason: { type: 'string', description: 'Why this is provisional/changeable, grounded in what the user said.' },
              },
              required: ['decision', 'reason'],
            },
          },
          knownForks: {
            type: 'array',
            description: 'Rework-risk decisions / weak spots surfaced during the interview.',
            items: {
              type: 'object',
              properties: {
                fork: { type: 'string' },
                consideration: { type: 'string', description: 'What to watch for or weigh when this comes up during the build.' },
              },
              required: ['fork', 'consideration'],
            },
          },
          conventions: {
            type: 'array',
            description: 'Each a discrete code style / testing / naming / file-org convention.',
            items: { type: 'string' },
          },
        },
        required: ['projectSummary', 'stackArchitecture', 'hardInvariants', 'softDecisions', 'knownForks', 'conventions'],
      },
      slicePlan: {
        type: 'object',
        properties: {
          slices: {
            type: 'array',
            description: 'Ordered, concrete build sequence reflecting the actual project scope discussed.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['title', 'description'],
            },
          },
        },
        required: ['slices'],
      },
    },
    required: ['claudeMd', 'slicePlan'],
  },
}
