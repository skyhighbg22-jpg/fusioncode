// ============================================================
// FusionCode — Bash Tool (cross-platform)
// Uses bash on Unix and cmd.exe on Windows so the agent works
// out of the box on both platforms without requiring git-bash.
// ============================================================

import { execa } from 'execa'
import process from 'process'
import type { Tool } from '../types/index.js'
import { error, ok, runTool, truncate } from './util.js'

const isWindows = process.platform === 'win32'
const DEFAULT_TIMEOUT = 30_000

export const bashTool: Tool = {
  name: 'bash',
  description:
    'Execute a shell command in the project directory. Uses bash on Unix and cmd.exe on Windows. Returns stdout and stderr.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to run' },
      timeout: { type: 'number', description: `Timeout in ms (default ${DEFAULT_TIMEOUT})` },
    },
    required: ['command'],
  },
  async execute(args, ctx) {
    if (ctx.readonly) return error('ERROR: bash is disabled in plan/review mode.')

    return runTool(async () => {
      const command = String(args.command ?? '').trim()
      if (!command) return error('No command provided.')

      const timeout = Number(args.timeout ?? DEFAULT_TIMEOUT)
      const shell = isWindows ? 'cmd.exe' : 'bash'
      const shellArgs = isWindows ? ['/d', '/s', '/c', command] : ['-c', command]

      const { stdout, stderr, exitCode } = await execa(shell, shellArgs, {
        cwd: ctx.cwd,
        timeout,
        reject: false,
      })

      const out = [stdout, stderr].filter(Boolean).join('\n').trim()
      if (!out) return ok(`(no output, exit code ${exitCode})`)
      const tagged = exitCode !== 0 ? `${out}\n[exit code ${exitCode}]` : out
      return ok(truncate(tagged))
    })
  },
}
