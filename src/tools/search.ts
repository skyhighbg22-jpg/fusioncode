// ============================================================
// FusionCode — Search Tools (native JS grep)
// A recursive text search that works cross-platform without
// relying on a system `grep` binary (which is absent on Windows
// unless git-bash is installed). Walks the file tree and applies
// a RegExp per file.
// ============================================================

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import type { Tool } from '../types/index.js'
import { DEFAULT_IGNORE, ok, runTool, truncate } from './util.js'

const MAX_MATCHES = 500
const MAX_LINE_LENGTH = 500

function buildPattern(pattern: string, caseInsensitive: boolean): RegExp {
  try {
    return new RegExp(pattern, caseInsensitive ? 'i' : '')
  } catch {
    // Treat as a literal string if it isn't valid regex.
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseInsensitive ? 'i' : '')
  }
}

export const grepTool: Tool = {
  name: 'grep',
  description:
    'Search for a regex pattern across files. Works cross-platform (no system grep needed). Returns `path:line:match` lines.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex or string to search for' },
      path: { type: 'string', description: 'File or directory to search in (default: .)' },
      glob: { type: 'string', description: 'Glob to filter files (default: **/*)' },
      ignore: { type: 'array', items: { type: 'string' }, description: 'Patterns to ignore' },
      ignore_case: { type: 'boolean', description: 'Case-insensitive match (default: false)' },
    },
    required: ['pattern'],
  },
  async execute(args, ctx) {
    return runTool(async () => {
      const patternStr = String(args.pattern ?? '')
      if (!patternStr) return ok('No pattern provided.')
      const regex = buildPattern(patternStr, Boolean(args.ignore_case))

      const target = String(args.path ?? '.')
      const fileGlob = String(args.glob ?? '**/*')
      const ignore = (args.ignore as string[]) ?? DEFAULT_IGNORE

      // Resolve target: a single file or a directory tree.
      const resolved = path.resolve(ctx.cwd, target)
      let files: string[]
      try {
        const stat = await fs.stat(resolved)
        if (stat.isFile()) {
          files = [resolved]
        } else {
          files = await glob(fileGlob, { cwd: resolved, ignore, absolute: true, nodir: true })
        }
      } catch {
        // Path doesn't exist — try treating target itself as a glob.
        files = await glob(target, { cwd: ctx.cwd, ignore, absolute: true, nodir: true })
      }

      const out: string[] = []
      let matchCount = 0
      for (const file of files) {
        if (matchCount >= MAX_MATCHES) {
          out.push(`...(truncated at ${MAX_MATCHES} matches)`)
          break
        }
        let content: string
        try {
          content = await fs.readFile(file, 'utf-8')
        } catch {
          continue // skip unreadable / binary files
        }
        const rel = path.relative(ctx.cwd, file) || file
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const linePreview =
              lines[i].length > MAX_LINE_LENGTH ? lines[i].slice(0, MAX_LINE_LENGTH) + '…' : lines[i]
            out.push(`${rel}:${i + 1}:${linePreview}`)
            matchCount++
            if (matchCount >= MAX_MATCHES) break
          }
        }
      }

      return ok(truncate(out.join('\n') || '(no matches)'))
    })
  },
}
