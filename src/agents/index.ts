// ============================================================
// FusionCode — Agent Runner
// Inspired by: KiloCode 5-agent system, OpenCode build/plan,
//              MiMoCode subagents, LevelCode multi-agent swarm
// ============================================================

import { randomUUID } from 'crypto'
import type { AgentMode, AgentSession, Message, StreamEvent, ToolCall, ToolContext } from '../types/index.js'
import { createProvider } from '../providers/base.js'
import { getToolsForAgent, toolsToOpenAISchema, executeTool } from '../tools/index.js'
import { RuntimeContext } from '../runtime/context.js'
import { getMode } from './modes/index.js'
import type { ModeStrategy } from './modes/index.js'
import { logger } from '../logger/index.js'
import { toErrorMessage, isAbortError } from '../utils/errors.js'

export interface RunOptions {
  mode?: AgentMode
  provider?: string
  model?: string
  cwd?: string
  maxIterations?: number
  onEvent?: (event: StreamEvent & { sessionId: string }) => void
  signal?: AbortSignal
  taskId?: string
  runtime?: RuntimeContext
}

export class AgentRunner {
  private session: AgentSession
  private cwd: string
  private readonly runtime: RuntimeContext
  private readonly mode: ModeStrategy
  private readonly maxIterations: number
  private readonly requestedProvider: string | undefined
  private readonly requestedModel: string | undefined

  constructor(options: RunOptions = {}) {
    const runtime = options.runtime ?? new RuntimeContext({ cwd: options.cwd })
    this.runtime = runtime

    const modeName = options.mode ?? runtime.config.defaultAgent
    this.mode = getMode(modeName)

    const providerName = options.provider ?? runtime.config.defaultProvider
    const providerConfig = runtime.config.providers[providerName]
    if (!providerConfig) {
      throw new Error(
        `Provider '${providerName}' not found in config. Available: ${Object.keys(runtime.config.providers).join(', ')}`,
      )
    }

    // Clone before applying a one-off --model override so the shared config
    // object is never mutated (it would leak into sibling swarm agents).
    const model = options.model ?? providerConfig.model
    this.requestedProvider = providerName
    this.requestedModel = model

    this.cwd = options.cwd ?? process.cwd()
    this.maxIterations = options.maxIterations ?? this.mode.maxIterations

    this.session = {
      id: randomUUID(),
      agent: this.mode.name,
      provider: providerName,
      model,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      taskId: options.taskId,
    }
  }

  get sessionId(): string {
    return this.session.id
  }

  get modeName(): AgentMode {
    return this.session.agent
  }

  async run(userPrompt: string, options: RunOptions = {}): Promise<string> {
    return this.runInner(userPrompt, options)
  }

  private async runInner(userPrompt: string, options: RunOptions): Promise<string> {
    const onEvent = options.onEvent
    const maxIterations = options.maxIterations ?? this.maxIterations

    // Build a provider with the (possibly overridden) model, without mutating config.
    const baseProviderConfig = this.runtime.config.providers[this.session.provider]
    const providerConfig =
      this.requestedModel && this.requestedModel !== baseProviderConfig.model
        ? { ...baseProviderConfig, model: this.requestedModel }
        : baseProviderConfig
    const provider = createProvider(providerConfig)

    const tools = getToolsForAgent(this.mode.name)
    const toolSchemas = toolsToOpenAISchema(tools)

    const ctx: ToolContext = {
      cwd: this.cwd,
      sessionId: this.session.id,
      agent: this.mode.name,
      readonly: this.mode.readonly,
    }

    // Build the system prompt from the mode strategy, plus memory context.
    let systemPrompt = this.mode.systemPrompt()
    if (this.runtime.config.memory.enabled) {
      try {
        const memory = this.runtime.getMemory()
        const memCtx = memory.getBudgetedContext(this.runtime.config.memory.maxTokensBudget)
        if (memCtx.trim()) systemPrompt += `\n\n${memCtx}`
      } catch (e) {
        logger.debug('Memory context unavailable', toErrorMessage(e))
      }
    }

    const systemMsg: Message = { role: 'system', content: systemPrompt }
    this.session.messages.push({ role: 'user', content: userPrompt })

    const runCtx = {
      runtime: this.runtime,
      sessionId: this.session.id,
      prompt: userPrompt,
      logger,
    }
    await this.mode.onRunStart?.(runCtx)

    const allMessages: Message[] = [systemMsg, ...this.session.messages]
    let iterations = 0
    let finalResponse = ''
    let exhausted = false
    let cancelled = false

    while (iterations < maxIterations) {
      iterations++
      this.session.updatedAt = new Date()

      let assistantText = ''
      const pendingToolCalls: ToolCall[] = []

      try {
        for await (const event of provider.stream(allMessages, toolSchemas, options.signal)) {
          onEvent?.({ ...event, sessionId: this.session.id })

          if (event.type === 'text' && event.content) {
            assistantText += event.content
          } else if (event.type === 'tool_call' && event.toolCall) {
            pendingToolCalls.push(event.toolCall)
          } else if (event.type === 'done') {
            break
          } else if (event.type === 'error') {
            throw new Error(event.error ?? 'Stream error')
          }
        }
      } catch (e) {
        if (isAbortError(e)) {
          // Esc-to-cancel: stop the loop, keep partial output, signal the TUI.
          cancelled = true
          finalResponse = assistantText
          onEvent?.({ type: 'error', error: 'cancelled', sessionId: this.session.id })
          break
        }
        throw e
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: assistantText,
        toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
      }
      this.session.messages.push(assistantMsg)
      allMessages.push(assistantMsg)

      if (pendingToolCalls.length === 0) {
        finalResponse = assistantText
        break
      }

      // Execute each tool call; surface arg-parse failures back to the model.
      for (const toolCall of pendingToolCalls) {
        let args: Record<string, unknown>
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
        } catch (e) {
          const msg = `Invalid JSON arguments for tool '${toolCall.function.name}': ${toErrorMessage(e)}. Got: ${toolCall.function.arguments.slice(0, 200)}`
          const result = { toolCallId: toolCall.id, result: msg, isError: true }
          onEvent?.({ type: 'tool_result', toolResult: result, sessionId: this.session.id })
          const toolMsg: Message = { role: 'tool', content: msg, toolCallId: toolCall.id }
          this.session.messages.push(toolMsg)
          allMessages.push(toolMsg)
          continue
        }

        const result = await executeTool(toolCall.function.name, args, ctx, toolCall.id)
        onEvent?.({ type: 'tool_result', toolResult: result, sessionId: this.session.id })

        const toolMsg: Message = {
          role: 'tool',
          content: result.result,
          toolCallId: toolCall.id,
        }
        this.session.messages.push(toolMsg)
        allMessages.push(toolMsg)
      }

      if (iterations >= maxIterations) exhausted = true
    }

    if (exhausted) {
      const warn = `Agent reached the iteration cap (${maxIterations}) without finishing. Last response:\n${finalResponse || '(empty)'}`
      onEvent?.({ type: 'error', error: warn, sessionId: this.session.id })
      logger.warn(warn)
    }

    if (!cancelled) await this.mode.onRunComplete?.(runCtx, finalResponse)
    return finalResponse
  }

  getSession(): AgentSession {
    return structuredClone(this.session)
  }
}

/** Agent factory. */
export function createAgent(options: RunOptions = {}): AgentRunner {
  return new AgentRunner(options)
}

/**
 * Swarm: run multiple agents in parallel (inspired by LevelCode swarm).
 * Each task gets its own RuntimeContext (forked) and its own AgentRunner,
 * so they don't share mutable state. A simple concurrency cap avoids
 * exhausting sockets / rate limits.
 */
export async function runSwarm(
  tasks: Array<{ prompt: string; mode: AgentMode; options?: RunOptions }>,
  onEvent?: (agentIndex: number, event: StreamEvent & { sessionId: string }) => void,
  concurrency = 4,
): Promise<string[]> {
  const results: string[] = new Array(tasks.length).fill('')

  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const i = cursor++
      const task = tasks[i]
      const agent = createAgent(task.options)
      // Preserve a caller-supplied onEvent inside task.options while also
      // forwarding to the swarm-level onEvent with the agent index.
      const innerOnEvent = task.options?.onEvent
      results[i] = await agent.run(task.prompt, {
        ...task.options,
        onEvent: (e) => {
          innerOnEvent?.(e)
          onEvent?.(i, e)
        },
      })
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}
