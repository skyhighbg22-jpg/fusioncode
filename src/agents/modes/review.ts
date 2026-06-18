// ============================================================
// FusionCode — Review Mode
// Read-only. Identifies security, performance, and style issues.
// ============================================================

import type { ModeStrategy, RunContext } from './base.js'
import { checkpoint } from './base.js'

export class ReviewMode implements ModeStrategy {
  readonly name = 'review' as const
  readonly description = 'Code quality analysis with actionable suggestions (read-only).'
  readonly readonly = true
  readonly maxIterations = 30

  systemPrompt(): string {
    return `You are FusionCode in REVIEW mode. You are READ-ONLY:
- Review code for security, performance, and style issues
- Check for missing tests and edge cases
- Read files and search the codebase as needed
- Do NOT modify files

Output a structured review. For each issue give: severity (critical/warning/info),
file and line (if applicable), the problem, and a concrete suggestion. Summarize
with an overall assessment at the end.`
  }

  async onRunComplete(ctx: RunContext, result: string): Promise<void> {
    await checkpoint(ctx, 'note', `Review of: ${ctx.prompt}\n${result.slice(0, 800)}`, ['review'])
  }
}
