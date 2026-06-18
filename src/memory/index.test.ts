import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { MemoryStore } from './index.js'

describe('MemoryStore', () => {
  let tmp: string
  let store: MemoryStore

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-mem-'))
    store = new MemoryStore(tmp)
  })
  afterEach(() => {
    store.close()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('creates its directory and db file', () => {
    expect(existsSync(join(tmp, '.fusion', 'memory', 'memory.db'))).toBe(true)
  })

  it('adds and retrieves entries via getAll', () => {
    const entry = store.addEntry({ type: 'fact', content: 'The sky is blue', tags: ['nature'] })
    expect(entry.id).toMatch(/^mem_/)
    const all = store.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].content).toBe('The sky is blue')
    expect(all[0].tags).toEqual(['nature'])
  })

  it('searches via FTS5', () => {
    store.addEntry({ type: 'fact', content: 'TypeScript compiles to JavaScript', tags: ['ts'] })
    store.addEntry({ type: 'note', content: 'Rust is memory safe', tags: ['rust'] })
    const results = store.search('TypeScript')
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('TypeScript')
  })

  it('respects the token budget in getBudgetedContext', () => {
    // Each 200-char entry is ~50 tokens. With a budget of 60 (~15 tokens of
    // room) only one entry can fit. getAll() returns DESC by created_at, so
    // the B entry (added second) comes first and is the one included.
    store.addEntry({ type: 'fact', content: 'A'.repeat(200), tags: [] })
    store.addEntry({ type: 'fact', content: 'B'.repeat(200), tags: [] })
    const ctx = store.getBudgetedContext(60)
    expect(ctx).toContain('## Relevant Memory')
    expect(ctx).toContain('B'.repeat(200))
    expect(ctx).not.toContain('A'.repeat(200))
  })

  it('returns empty string when budget is too small for any entry', () => {
    store.addEntry({ type: 'fact', content: 'A'.repeat(1000), tags: [] })
    const c = store.getBudgetedContext(1)
    expect(c).toBe('')
  })

  it('deletes entries', () => {
    const entry = store.addEntry({ type: 'note', content: 'temp', tags: [] })
    store.deleteEntry(entry.id)
    expect(store.getAll()).toHaveLength(0)
  })

  it('supports the task tree', () => {
    const parent = store.addTask({ title: 'parent', description: '', status: 'pending' })
    store.addTask({ title: 'child', description: '', status: 'pending', parentId: parent.id })
    const roots = store.getTasks()
    expect(roots).toHaveLength(1)
    expect(roots[0].children).toHaveLength(1)
  })
})
