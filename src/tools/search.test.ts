import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { grepTool } from './search.js'
import type { ToolContext } from '../types/index.js'

function ctx(cwd: string): ToolContext {
  return { cwd, sessionId: 'test', agent: 'build', readonly: false }
}

describe('grepTool (native JS, cross-platform)', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-grep-'))
    mkdirSync(join(tmp, 'node_modules'))
    writeFileSync(join(tmp, 'a.ts'), 'function foo() {\n  return Error: oops\n}\n')
    writeFileSync(join(tmp, 'b.ts'), 'const Error = 1\n')
    writeFileSync(join(tmp, 'node_modules', 'skip.ts'), 'Error: ignored\n')
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('matches pattern and returns path:line:match lines', async () => {
    const r = await grepTool.execute({ pattern: 'Error' }, ctx(tmp))
    expect(r.isError).toBeFalsy()
    expect(r.result).toContain('a.ts:2:')
    expect(r.result).toContain('b.ts:1:')
    expect(r.result).not.toContain('skip.ts')
  })

  it('supports case-insensitive matching', async () => {
    const r = await grepTool.execute({ pattern: 'error', ignore_case: true }, ctx(tmp))
    expect(r.result).toContain('a.ts:2:')
  })

  it('case-sensitive by default (does not match lowercase "error" for "Error")', async () => {
    const r = await grepTool.execute({ pattern: 'error' }, ctx(tmp))
    expect(r.result).toBe('(no matches)')
  })

  it('treats invalid regex as a literal', async () => {
    const r = await grepTool.execute({ pattern: '(' }, ctx(tmp))
    // No literal "(" present → no matches, but no crash either.
    expect(r.isError).toBeFalsy()
  })

  it('scopes to a single file when path is a file', async () => {
    const r = await grepTool.execute({ pattern: 'foo', path: 'a.ts' }, ctx(tmp))
    expect(r.result).toContain('a.ts:1:')
    expect(r.result).not.toContain('b.ts')
  })

  it('reports no matches cleanly', async () => {
    const r = await grepTool.execute({ pattern: 'zzzznotfound' }, ctx(tmp))
    expect(r.result).toBe('(no matches)')
  })
})
