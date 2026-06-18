import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { readFileTool, writeFileTool, editFileTool, listDirTool, globFilesTool } from './files.js'
import type { ToolContext } from '../types/index.js'

function ctx(cwd: string): ToolContext {
  return { cwd, sessionId: 'test', agent: 'build', readonly: false }
}

describe('readFileTool', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-read-'))
    writeFileSync(join(tmp, 'sample.txt'), 'line1\nline2\nline3\nline4\nline5\n')
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('reads the whole file when no range given', async () => {
    const r = await readFileTool.execute({ path: 'sample.txt' }, ctx(tmp))
    expect(r.isError).toBeFalsy()
    expect(r.result.startsWith('line1')).toBe(true)
    expect(r.result).toContain('line5')
  })

  it('start_line=1,end_line=1 returns only the first line (1-indexed inclusive)', async () => {
    const r = await readFileTool.execute({ path: 'sample.txt', start_line: 1, end_line: 1 }, ctx(tmp))
    expect(r.result).toBe('line1')
  })

  it('start_line=5,end_line=5 returns the 5th line (off-by-one regression)', async () => {
    const r = await readFileTool.execute({ path: 'sample.txt', start_line: 5, end_line: 5 }, ctx(tmp))
    expect(r.result).toBe('line5')
  })

  it('a 2-line slice is inclusive on both ends', async () => {
    const r = await readFileTool.execute({ path: 'sample.txt', start_line: 2, end_line: 3 }, ctx(tmp))
    expect(r.result).toBe('line2\nline3')
  })

  it('errors on a missing file', async () => {
    const r = await readFileTool.execute({ path: 'nope.txt' }, ctx(tmp))
    expect(r.isError).toBe(true)
  })
})

describe('writeFileTool', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-write-'))
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('creates parent directories', async () => {
    const r = await writeFileTool.execute({ path: 'nested/dir/file.txt', content: 'hi' }, ctx(tmp))
    expect(r.isError).toBeFalsy()
  })

  it('is blocked in readonly mode', async () => {
    const r = await writeFileTool.execute(
      { path: 'file.txt', content: 'hi' },
      { ...ctx(tmp), readonly: true },
    )
    expect(r.isError).toBe(true)
    expect(r.result).toContain('disabled')
  })
})

describe('editFileTool', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-edit-'))
    writeFileSync(join(tmp, 'f.txt'), 'alpha\nbeta\ngamma\n')
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('replaces the first match', async () => {
    await editFileTool.execute({ path: 'f.txt', old_string: 'beta', new_string: 'BETA' }, ctx(tmp))
    const r = await readFileTool.execute({ path: 'f.txt' }, ctx(tmp))
    expect(r.result).toContain('BETA')
  })

  it('errors when old_string is not found', async () => {
    const r = await editFileTool.execute({ path: 'f.txt', old_string: 'zzz', new_string: 'zz' }, ctx(tmp))
    expect(r.isError).toBe(true)
  })

  it('is blocked in readonly mode', async () => {
    const r = await editFileTool.execute(
      { path: 'f.txt', old_string: 'a', new_string: 'b' },
      { ...ctx(tmp), readonly: true },
    )
    expect(r.isError).toBe(true)
  })
})

describe('listDirTool', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-list-'))
    mkdirSync(join(tmp, 'sub'))
    writeFileSync(join(tmp, 'a.txt'), 'x')
    writeFileSync(join(tmp, 'b.md'), 'x')
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('lists entries with d/f markers', async () => {
    const r = await listDirTool.execute({ path: '.' }, ctx(tmp))
    expect(r.result).toContain('d  sub/')
    expect(r.result).toContain('f  a.txt')
    expect(r.result).toContain('f  b.md')
  })
})

describe('globFilesTool', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-glob-'))
    writeFileSync(join(tmp, 'a.ts'), 'x')
    writeFileSync(join(tmp, 'b.js'), 'x')
    mkdirSync(join(tmp, 'node_modules'))
    writeFileSync(join(tmp, 'node_modules', 'skip.ts'), 'x')
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('matches files and ignores node_modules by default', async () => {
    const r = await globFilesTool.execute({ pattern: '**/*' }, ctx(tmp))
    expect(r.result).toContain('a.ts')
    expect(r.result).toContain('b.js')
    expect(r.result).not.toContain('skip.ts')
  })
})
