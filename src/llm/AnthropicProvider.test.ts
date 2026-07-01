import { describe, expect, it, vi, beforeEach } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'

const createMock = vi.fn()

vi.mock('@anthropic-ai/sdk', async () => {
  const actual = await vi.importActual<typeof import('@anthropic-ai/sdk')>('@anthropic-ai/sdk')

  class FakeAnthropic {
    messages = { create: createMock }
    constructor(_opts: unknown) {}
  }

  return {
    ...actual,
    default: Object.assign(FakeAnthropic, {
      AuthenticationError: actual.AuthenticationError,
      RateLimitError: actual.RateLimitError,
      APIConnectionError: actual.APIConnectionError,
      APIError: actual.APIError,
    }),
  }
})

import { AnthropicProvider } from './AnthropicProvider'
import { LLMProviderError } from './LLMProvider'

describe('AnthropicProvider', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('sends the forced tool_choice and model id, and never touches the real network', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'interview_turn', input: { message: 'hi', coverage: [], decisions: [], readyToGenerate: false } }],
    })

    const provider = new AnthropicProvider('sk-ant-test')
    const result = await provider.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [{ name: 'interview_turn', description: 'd', inputSchema: { type: 'object' } }],
      toolChoice: { type: 'tool', name: 'interview_turn' },
    })

    expect(createMock).toHaveBeenCalledTimes(1)
    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-sonnet-5')
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'interview_turn' })
    expect(result.toolUse?.name).toBe('interview_turn')
  })

  it('maps AuthenticationError to an auth LLMProviderError', async () => {
    const err = Object.create(Anthropic.AuthenticationError.prototype)
    createMock.mockRejectedValue(err)

    const provider = new AnthropicProvider('sk-ant-test')
    await expect(
      provider.complete({ system: 's', messages: [] }),
    ).rejects.toMatchObject({ kind: 'auth' } satisfies Partial<LLMProviderError>)
  })

  it('maps RateLimitError to a rate_limit LLMProviderError', async () => {
    const err = Object.create(Anthropic.RateLimitError.prototype)
    createMock.mockRejectedValue(err)

    const provider = new AnthropicProvider('sk-ant-test')
    await expect(
      provider.complete({ system: 's', messages: [] }),
    ).rejects.toMatchObject({ kind: 'rate_limit' })
  })

  it('maps APIConnectionError to a network LLMProviderError', async () => {
    const err = Object.create(Anthropic.APIConnectionError.prototype)
    createMock.mockRejectedValue(err)

    const provider = new AnthropicProvider('sk-ant-test')
    await expect(
      provider.complete({ system: 's', messages: [] }),
    ).rejects.toMatchObject({ kind: 'network' })
  })
})
