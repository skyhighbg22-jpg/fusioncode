// ============================================================
// FusionCode — Check Mode
// Runs the project's CI checks (lint, typecheck, test, audit)
// via the bash tool and reports a structured pass/warn/fail
// summary. Read-write so it can invoke the check commands.
// ============================================================

import type { ModeStrategy, RunContext } from './base.js'
import { checkpoint } from './base.js'

export class CheckMode implements ModeStrategy {
  readonly name = 'check' as const
  readonly description = 'Run CI-style checks (lint, typecheck, tests, security audit).'
  readonly readonly = false
  readonly maxIterations = 20

  systemPrompt(): string {
    return `You are FusionCode in CHECK mode. Run the project's quality checks and report
results. Use the bash tool to run the available checks (skip any whose tooling is
not installed). For each check report status pass | warn | fail with a short message.

Checks to run, in order:
1. TypeScript: \`npx tsc --noEmit\`
2. Lint: \`npm run lint\` (skip if no lint script)
3. Tests: \`npm test\` (skip if no test script)
4. Security audit: \`npm audit --omit=dev\`

Report a final structured summary. Do not modify files; only run checks and report.`
  }

  async onRunComplete(ctx: RunContext, result: string): Promise<void> {
    await checkpoint(ctx, 'note', `Check run\n${result.slice(0, 800)}`, ['check'])
  }
}
