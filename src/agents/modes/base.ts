// ============================================================
// FusionCode — Mode Strategy Base
// Each agent mode is a ModeStrategy: it supplies the system
// prompt, declares read-only vs. full access and an iteration
// cap, and optionally runs start/complete hooks (e.g. build mode
// auto-commits and checkpoints on completion).
//
// AgentRunner owns the single streaming + tool-call loop and
// consults the active strategy — there is no per-mode orchestration
// pipeline. Richer per-mode behaviour lives in the typed hooks.
// ============================================================

import type { AgentMode } from '../../types/index.js'
import type { RuntimeContext } from '../../runtime/context.js'
import type { Logger } from '../../logger/index.js'

export interface RunContext {
  runtime: RuntimeContext
  sessionId: string
  prompt: string
  logger: Logger
}

export interface ModeStrategy {
  readonly name: AgentMode
  readonly description: string
  readonly readonly: boolean
  readonly maxIterations: number
  systemPrompt(): string
  onRunStart?(ctx: RunContext): Promise<void>
  onRunComplete?(ctx: RunContext, result: string): Promise<void>
}

/** Shared helper: store a memory checkpoint, never throwing. Skipped when
 *  memory is disabled in config (so modes never open a DB unintentionally). */
async function checkpoint(
  ctx: RunContext,
  type: 'fact' | 'note' | 'checkpoint',
  content: string,
  tags: string[],
): Promise<void> {
  if (!ctx.runtime.config.memory.enabled) return
  try {
    ctx.runtime.getMemory().addEntry({ type, content, tags, sessionId: ctx.sessionId })
  } catch (e) {
    ctx.logger.warn('Memory checkpoint failed', (e as Error).message)
  }
}

export { checkpoint }
