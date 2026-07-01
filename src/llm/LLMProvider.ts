export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: object
}

export interface LLMResponse {
  toolUse?: { name: string; input: unknown }
  text?: string
}

export type LLMProviderErrorKind = 'auth' | 'rate_limit' | 'network' | 'server' | 'unknown'

export class LLMProviderError extends Error {
  kind: LLMProviderErrorKind

  constructor(kind: LLMProviderErrorKind, message: string) {
    super(message)
    this.name = 'LLMProviderError'
    this.kind = kind
  }
}

export interface LLMProvider {
  complete(params: {
    system: string
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    toolChoice?: { type: 'tool'; name: string }
  }): Promise<LLMResponse>
}
