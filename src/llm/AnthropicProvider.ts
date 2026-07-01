import Anthropic from '@anthropic-ai/sdk'
import type { LLMMessage, LLMProvider, LLMResponse, ToolDefinition } from './LLMProvider'
import { LLMProviderError } from './LLMProvider'

const MODEL = 'claude-sonnet-5'

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  }

  async complete(params: {
    system: string
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    toolChoice?: { type: 'tool'; name: string }
  }): Promise<LLMResponse> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: params.system,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        tools: params.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
        })),
        tool_choice: params.toolChoice,
      })

      const toolUseBlock = response.content.find((b) => b.type === 'tool_use')
      if (toolUseBlock && toolUseBlock.type === 'tool_use') {
        return { toolUse: { name: toolUseBlock.name, input: toolUseBlock.input } }
      }

      const textBlock = response.content.find((b) => b.type === 'text')
      return { text: textBlock && textBlock.type === 'text' ? textBlock.text : undefined }
    } catch (error) {
      throw mapAnthropicError(error)
    }
  }
}

function mapAnthropicError(error: unknown): LLMProviderError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new LLMProviderError('auth', 'Your API key was rejected. Check it in Settings.')
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new LLMProviderError('rate_limit', 'Rate limited. Please wait a moment and try again.')
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new LLMProviderError('network', 'Network error reaching the API. Check your connection and try again.')
  }
  if (error instanceof Anthropic.APIError) {
    return new LLMProviderError('server', 'The API returned an error. Please try again.')
  }
  return new LLMProviderError('unknown', 'Something went wrong. Please try again.')
}
