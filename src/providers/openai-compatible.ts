// ============================================================
// FusionCode — OpenAI-Compatible Provider
// Covers: OpenAI, DeepSeek, Groq, Mistral, OpenRouter,
//         Ollama, LM Studio, Together, and any
//         OpenAI-compatible endpoint
// Inspired by: OpenClaude provider abstraction
// ============================================================

import OpenAI from 'openai'
import type { Message, StreamEvent, ProviderConfig, ToolCall, FunctionToolSchema } from '../types/index.js'
import { BaseProvider, registerProvider } from './base.js'

const DEFAULT_MAX_TOKENS = 8192
const DEFAULT_TEMPERATURE = 0.2

/** Provider presets that don't require a remote API key (local servers). */
const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio', 'custom'])

export const PROVIDER_PRESETS: Record<string, Partial<ProviderConfig>> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.7-sonnet' },
  together: { baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3-70b-chat-hf' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: 'ollama' },
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local-model', apiKey: 'lm-studio' },
  cohere: { baseUrl: 'https://api.cohere.ai/compatibility/v1', model: 'command-r-plus' },
  custom: { baseUrl: 'http://localhost:8080/v1', model: 'custom' },
}

/** Resolve an API key, failing clearly for remote providers that need one. */
function resolveApiKey(config: ProviderConfig, preset: Partial<ProviderConfig>): string {
  const key = config.apiKey ?? preset.apiKey
  if (key) return key
  // Local servers (ollama, lmstudio, etc.) don't need a real key.
  if (LOCAL_PROVIDERS.has(config.name)) return 'local'
  const envKey = process.env.OPENAI_API_KEY
  if (envKey) return envKey
  throw new Error(
    `No API key for provider '${config.name}'. Set the provider's API key in fusioncode.json ` +
      `or the corresponding environment variable (e.g. OPENAI_API_KEY).`,
  )
}

export class OpenAICompatibleProvider extends BaseProvider {
  private client: OpenAI

  constructor(config: ProviderConfig) {
    super(config)
    const preset = PROVIDER_PRESETS[config.name] ?? {}
    this.client = new OpenAI({
      apiKey: resolveApiKey(config, preset),
      baseURL: config.baseUrl ?? preset.baseUrl,
      defaultHeaders: config.headers,
    })
  }

  get name(): string {
    return this.config.name
  }
  get supportsStreaming(): boolean {
    return true
  }
  get supportsVision(): boolean {
    return ['openai', 'openrouter', 'groq'].includes(this.config.name)
  }
  get supportsTools(): boolean {
    return true
  }

  async chat(messages: Message[], tools?: FunctionToolSchema[], signal?: AbortSignal): Promise<Message> {
    const response = await this.client.chat.completions.create(
      {
        model: this.config.model,
        messages: this.formatMessages(messages),
        tools: tools as OpenAI.ChatCompletionTool[] | undefined,
        max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
      },
      { signal },
    )

    const choice = response.choices[0]
    if (!choice?.message) throw new Error('No response from provider')

    return {
      role: 'assistant',
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    }
  }

  async *stream(
    messages: Message[],
    tools?: FunctionToolSchema[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.config.model,
        messages: this.formatMessages(messages),
        tools: tools as OpenAI.ChatCompletionTool[] | undefined,
        max_tokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
        stream: true,
      },
      { signal },
    )

    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      if (delta.content) {
        yield { type: 'text', content: delta.content }
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolCallBuffers.has(idx)) {
            toolCallBuffers.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' })
          }
          const buf = toolCallBuffers.get(idx)!
          if (tc.id) buf.id = tc.id
          if (tc.function?.name) buf.name = tc.function.name
          if (tc.function?.arguments) buf.args += tc.function.arguments
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        for (const [, buf] of toolCallBuffers) {
          yield {
            type: 'tool_call',
            toolCall: { id: buf.id, type: 'function', function: { name: buf.name, arguments: buf.args } },
          }
        }
        toolCallBuffers.clear()
      }
    }

    // Flush any buffered tool calls that arrived without an explicit tool_calls finish_reason.
    if (toolCallBuffers.size > 0) {
      for (const [, buf] of toolCallBuffers) {
        yield {
          type: 'tool_call',
          toolCall: { id: buf.id, type: 'function', function: { name: buf.name, arguments: buf.args } },
        }
      }
      toolCallBuffers.clear()
    }

    yield { type: 'done' }
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Rough estimate: ~4 chars per token. Include tool-call arguments so
    // tool-heavy turns aren't undercounted for budget decisions.
    const text = messages
      .map((m) => {
        const body = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        const toolArgs = (m.toolCalls ?? []).map((tc: ToolCall) => tc.function.arguments).join(' ')
        return toolArgs ? `${body} ${toolArgs}` : body
      })
      .join(' ')
    return Math.ceil(text.length / 4)
  }

  protected clone(config: ProviderConfig): BaseProvider {
    return new OpenAICompatibleProvider(config)
  }

  private formatMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          tool_call_id: m.toolCallId ?? '',
        }
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: typeof m.content === 'string' ? m.content : null,
          tool_calls: m.toolCalls.map((tc: ToolCall) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        }
      }
      return {
        role: m.role as 'user' | 'assistant' | 'system',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }
    })
  }
}

// Register all OpenAI-compatible provider variants
const openaiCompatibleProviders = [
  'openai',
  'deepseek',
  'groq',
  'mistral',
  'openrouter',
  'together',
  'ollama',
  'lmstudio',
  'cohere',
  'custom',
] as const

for (const providerName of openaiCompatibleProviders) {
  registerProvider(providerName, (config) => {
    const preset = PROVIDER_PRESETS[providerName] ?? {}
    return new OpenAICompatibleProvider({
      ...preset,
      ...config,
      name: providerName,
    })
  })
}
