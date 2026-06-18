// ============================================================
// FusionCode — Debug Mode
// Full access. On completion: auto-commit fixes (if enabled) and
// store a memory note of the root cause.
// ============================================================

import type { ModeStrategy, RunContext } from './base.js'
import { checkpoint } from './base.js'

export class DebugMode implements ModeStrategy {
  readonly name = 'debug' as const
  readonly description = 'Root-cause analysis and fix generation for errors.'
  readonly readonly = false
  readonly maxIterations = 50

  systemPrompt(): string {
    return `You are FusionCode in DEBUG mode. You have full access:
- Read logs, traces, and error messages
- Write debug scripts and patches
- Run diagnostic commands

Trace the root cause methodically: reproduce the error, read the relevant code and
logs, identify the failing line, and apply a minimal fix. After fixing, verify the
fix (re-run the failing command or tests). Explain the root cause, then apply the fix.`
  }

  async onRunComplete(ctx: RunContext, result: string): Promise<void> {
    const { runtime, prompt } = ctx

    if (runtime.config.git.autoCommit) {
      try {
        const git = runtime.getGit()
        if ((await git.isGitRepo()) && (await git.hasChanges())) {
          const message = `fix: ${prompt.slice(0, 60)}`
          const hash = await git.autoCommit(message, runtime.config.git.commitMessagePrefix)
          if (hash) ctx.logger.info(`Auto-committed fix ${hash}`)
        }
      } catch (e) {
        ctx.logger.warn('Auto-commit failed', (e as Error).message)
      }
    }

    await checkpoint(ctx, 'note', `Debug task: ${prompt}\nOutcome: ${result.slice(0, 500)}`, ['debug'])
  }
}
