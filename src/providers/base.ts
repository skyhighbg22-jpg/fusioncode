// ============================================================
// FusionCode — Provider Base Abstraction
// Inspired by: OpenClaude multi-provider, OpenCode llm package
// ============================================================

import type { Message, StreamEvent, ProviderConfig, FunctionToolSchema } from '../types/index.js'

export abstract class BaseProvider {
  protected config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  abstract get name(): string
  abstract get supportsStreaming(): boolean
  abstract get supportsVision(): boolean
  abstract get supportsTools(): boolean

  abstract chat(messages: Message[], tools?: FunctionToolSchema[], signal?: AbortSignal): Promise<Message>

  abstract stream(
    messages: Message[],
    tools?: FunctionToolSchema[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent>

  abstract countTokens(messages: Message[]): Promise<number>

  getModel(): string {
    return this.config.model
  }

  withModel(model: string): BaseProvider {
    return this.clone({ ...this.config, model })
  }

  protected abstract clone(config: ProviderConfig): BaseProvider
}

// Provider Registry
const registry = new Map<string, (config: ProviderConfig) => BaseProvider>()

export function registerProvider(name: string, factory: (config: ProviderConfig) => BaseProvider): void {
  registry.set(name, factory)
}

export function createProvider(config: ProviderConfig): BaseProvider {
  const factory = registry.get(config.name)
  if (!factory) {
    throw new Error(`Unknown provider: ${config.name}. Available: ${[...registry.keys()].join(', ')}`)
  }
  return factory(config)
}

export function listProviders(): string[] {
  return [...registry.keys()]
}
