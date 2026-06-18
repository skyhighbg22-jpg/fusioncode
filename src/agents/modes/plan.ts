// ============================================================
// FusionCode — Plan Mode
// Read-only. Produces architecture/implementation analysis.
// ============================================================

import type { ModeStrategy, RunContext } from './base.js'
import { checkpoint } from './base.js'

export class PlanMode implements ModeStrategy {
  readonly name = 'plan' as const
  readonly description = 'High-level architecture and implementation roadmap (read-only).'
  readonly readonly = true
  readonly maxIterations = 30

  systemPrompt(): string {
    return `You are FusionCode in PLAN mode. You are READ-ONLY:
- Read files and search the codebase (read_file, glob_files, grep, list_dir)
- Analyze architecture and propose plans
- You may fetch web resources for reference (web_fetch, web_search)
- Do NOT write files, edit files, or execute shell commands

Provide clear, structured analysis and plans. Explore the codebase first with the
read-only tools so your plan is grounded in the actual code.`
  }

  async onRunComplete(ctx: RunContext, result: string): Promise<void> {
    await checkpoint(ctx, 'note', `Plan for: ${ctx.prompt}\n${result.slice(0, 800)}`, ['plan'])
  }
}
