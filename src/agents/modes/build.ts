// ============================================================
// FusionCode — Build Mode
// Full read/write access. On completion: auto-commit (if enabled
// in config) and store a memory checkpoint.
// ============================================================

import type { ModeStrategy, RunContext } from './base.js'
import { checkpoint } from './base.js'

export class BuildMode implements ModeStrategy {
  readonly name = 'build' as const
  readonly description = 'Implement features, fix bugs, refactor code, and run commands.'
  readonly readonly = false
  readonly maxIterations = 50

  systemPrompt(): string {
    return `You are FusionCode in BUILD mode. You have full access:
- Read and write files (read_file, write_file, edit_file)
- Execute shell commands (bash)
- Search the codebase (glob_files, grep, list_dir) and the web (web_fetch, web_search)

Complete the user's task thoroughly. Make changes directly using the tools. Prefer
edit_file for targeted changes over write_file. After implementing, verify your work
by reading back the changed files or running relevant checks.`
  }

  async onRunStart(ctx: RunContext): Promise<void> {
    ctx.logger.info(`Build session ${ctx.sessionId.slice(0, 8)} starting`)
  }

  async onRunComplete(ctx: RunContext, result: string): Promise<void> {
    const { runtime, prompt } = ctx

    // Auto-commit if the user opted in via config.
    if (runtime.config.git.autoCommit) {
      try {
        const git = runtime.getGit()
        if ((await git.isGitRepo()) && (await git.hasChanges())) {
          const message = `build: ${prompt.slice(0, 60)}`
          const hash = await git.autoCommit(message, runtime.config.git.commitMessagePrefix)
          if (hash) ctx.logger.info(`Auto-committed ${hash}`)
        }
      } catch (e) {
        ctx.logger.warn('Auto-commit failed', (e as Error).message)
      }
    }

    // Store a memory checkpoint of what was done.
    await checkpoint(ctx, 'checkpoint', `Build task: ${prompt}\nResult: ${result.slice(0, 500)}`, ['build'])
  }
}
