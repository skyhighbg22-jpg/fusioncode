import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { AgentRunner, createAgent } from './index.js'
import { BaseProvider, registerProvider } from '../providers/base.js'
import { RuntimeContext } from '../runtime/context.js'
import { DEFAULT_CONFIG } from '../config/defaults.js'
import type { Message, StreamEvent, ProviderConfig, FunctionToolSchema } from '../types/index.js'

// ---- Mock provider: replays a scripted sequence of stream events ----
class MockProvider extends BaseProvider {
  constructor(
    config: ProviderConfig,
    private readonly scripts: StreamEvent[][],
  ) {
    super(config)
  }
  get name() {
    return this.config.name
  }
  get supportsStreaming() {
    return true
  }
  get supportsVision() {
    return false
  }
  get supportsTools() {
    return true
  }

  private call = 0
  async chat(): Promise<Message> {
    return { role: 'assistant', content: 'mock' }
  }

  async *stream(_messages: Message[], _tools?: FunctionToolSchema[]): AsyncGenerator<StreamEvent> {
    const script = this.scripts[this.call] ?? this.scripts[this.scripts.length - 1]
    this.call++
    for (const ev of script) yield ev
    yield { type: 'done' }
  }

  async countTokens(): Promise<number> {
    return 0
  }
  protected clone(config: ProviderConfig): BaseProvider {
    return new MockProvider(config, this.scripts)
  }
}

function mockRuntime(tmp: string, mockProviders: Record<string, ProviderConfig> = {}): RuntimeContext {
  const config = { ...DEFAULT_CONFIG, providers: { ...DEFAULT_CONFIG.providers, ...mockProviders } }
  // Disable memory + autoCommit so the loop is isolated.
  config.memory = { ...config.memory, enabled: false }
  config.git = { ...config.git, autoCommit: false }
  return new RuntimeContext({ config, cwd: tmp })
}

describe('AgentRunner', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-agent-'))
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('returns assistant text when no tool calls are made', async () => {
    registerProvider('mock-text', (c) => new MockProvider(c, [[{ type: 'text', content: 'Hello there' }]]))
    const runtime = mockRuntime(tmp, {
      'mock-text': { name: 'mock-text', baseUrl: 'http://x', apiKey: 'k', model: 'm' },
    })
    const runner = new AgentRunner({ mode: 'build', provider: 'mock-text', runtime })
    const result = await runner.run('hi')
    expect(result).toBe('Hello there')
  })

  it('executes a tool call and feeds the result back, then finishes', async () => {
    registerProvider(
      'mock-tool',
      (c) =>
        new MockProvider(c, [
          [
            {
              type: 'tool_call',
              toolCall: {
                id: 't1',
                type: 'function',
                function: { name: 'list_dir', arguments: '{"path":"."}' },
              },
            },
          ],
          [{ type: 'text', content: 'Done after listing' }],
        ]),
    )

    const events: StreamEvent[] = []
    const runtime = mockRuntime(tmp, {
      'mock-tool': { name: 'mock-tool', baseUrl: 'http://x', apiKey: 'k', model: 'm' },
    })
    const runner = new AgentRunner({ mode: 'build', provider: 'mock-tool', runtime })
    const result = await runner.run('list the dir', {
      onEvent: (e) => {
        if (e.type === 'tool_result') events.push(e)
      },
    })

    expect(result).toBe('Done after listing')
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('tool_result')
    expect((events[0] as { toolResult?: { result: string } }).toolResult?.result).not.toBe('')
  })

  it('surfaces an error event when maxIterations is exhausted (regression)', async () => {
    // Every call emits a tool call — the loop never terminates naturally.
    registerProvider(
      'mock-loop',
      (c) =>
        new MockProvider(c, [
          [
            {
              type: 'tool_call',
              toolCall: {
                id: 't',
                type: 'function',
                function: { name: 'list_dir', arguments: '{"path":"."}' },
              },
            },
          ],
        ]),
    )

    let sawExhaustionError = false
    const runtime = mockRuntime(tmp, {
      'mock-loop': { name: 'mock-loop', baseUrl: 'http://x', apiKey: 'k', model: 'm' },
    })
    const runner = new AgentRunner({ mode: 'build', provider: 'mock-loop', runtime })
    await runner.run('loop forever', {
      maxIterations: 2,
      onEvent: (e) => {
        if (e.type === 'error' && /iteration cap/i.test(e.error ?? '')) sawExhaustionError = true
      },
    })
    expect(sawExhaustionError).toBe(true)
  })

  it('does not mutate shared config when --model override is applied', async () => {
    registerProvider('mock-mut', (c) => new MockProvider(c, [[{ type: 'text', content: 'ok' }]]))
    const runtime = mockRuntime(tmp, {
      'mock-mut': { name: 'mock-mut', baseUrl: 'http://x', apiKey: 'k', model: 'original-model' },
    })
    runtime.config.defaultProvider = 'mock-mut'

    const runner = new AgentRunner({ mode: 'build', provider: 'mock-mut', model: 'override-model', runtime })
    await runner.run('hi')
    // The shared config's provider model must be unchanged.
    expect(runtime.config.providers['mock-mut'].model).toBe('original-model')
  })

  it('createAgent is a working factory', () => {
    const runtime = mockRuntime(tmp, {
      'mock-text': { name: 'mock-text', baseUrl: 'http://x', apiKey: 'k', model: 'm' },
    })
    const agent = createAgent({ mode: 'build', provider: 'mock-text', runtime })
    expect(agent).toBeInstanceOf(AgentRunner)
    expect(agent.modeName).toBe('build')
  })
})
