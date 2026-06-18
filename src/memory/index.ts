// ============================================================
// FusionCode — Memory System
// Inspired by: MiMoCode persistent memory (SQLite FTS5),
//              OpenClaude memdir, checkpoint system
// ============================================================

import Database from 'better-sqlite3'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import type { MemoryEntry, Task } from '../types/index.js'
import { toErrorMessage } from '../utils/errors.js'

const MEMORY_VERSION = 1

export class MemoryStore {
  private db: Database.Database
  private memDir: string

  constructor(projectRoot: string, memDir = '.fusion/memory') {
    this.memDir = path.join(projectRoot, memDir)
    const dbPath = path.join(this.memDir, 'memory.db')

    // Ensure the directory exists before opening the DB.
    fsSync.mkdirSync(this.memDir, { recursive: true })

    try {
      this.db = new Database(dbPath)
    } catch (e) {
      throw new Error(`Could not open memory database at ${dbPath}: ${toErrorMessage(e)}`)
    }

    try {
      this.initSchema()
      this.migrate()
    } catch (e) {
      // Best-effort close on init failure.
      try {
        this.db.close()
      } catch {
        /* ignore */
      }
      throw new Error(`Could not initialize memory schema: ${toErrorMessage(e)}`)
    }
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        session_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_created_at ON memory(created_at);

      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts
        USING fts5(id UNINDEXED, content, tags, content='memory', content_rowid='rowid');

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `)
  }

  /** Real migration check: runs only when the stored version is below MEMORY_VERSION. */
  private migrate(): void {
    const row = this.db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
    const current = row?.version ?? 0
    if (current >= MEMORY_VERSION) return

    // Future migrations would be applied here, incrementally.
    // (Currently a no-op: version 1 is the initial schema.)
    this.db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(MEMORY_VERSION)
  }

  // ---- Memory entries ----
  addEntry(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): MemoryEntry {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO memory (id, type, content, tags, session_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, entry.type, entry.content, JSON.stringify(entry.tags ?? []), entry.sessionId ?? null, now, now)
    // Update FTS index.
    this.db
      .prepare('INSERT INTO memory_fts(id, content, tags) VALUES (?, ?, ?)')
      .run(id, entry.content, entry.tags?.join(' ') ?? '')
    return { id, ...entry, createdAt: new Date(now) }
  }

  search(query: string, limit = 20): MemoryEntry[] {
    // Escape quotes for the FTS MATCH string.
    const safe = query.replace(/"/g, '""')
    const rows = this.db
      .prepare(
        `SELECT m.* FROM memory m
         INNER JOIN memory_fts f ON m.id = f.id
         WHERE memory_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(`"${safe}"`, limit) as Array<Record<string, unknown>>
    return rows.map(MemoryStore.rowToEntry)
  }

  getAll(type?: string): MemoryEntry[] {
    const rows = type
      ? this.db.prepare('SELECT * FROM memory WHERE type = ? ORDER BY created_at DESC').all(type)
      : this.db.prepare('SELECT * FROM memory ORDER BY created_at DESC').all()
    return (rows as Array<Record<string, unknown>>).map(MemoryStore.rowToEntry)
  }

  deleteEntry(id: string): void {
    this.db.prepare('DELETE FROM memory WHERE id = ?').run(id)
    this.db.prepare('DELETE FROM memory_fts WHERE id = ?').run(id)
  }

  private static rowToEntry(row: Record<string, unknown>): MemoryEntry {
    return {
      id: String(row.id),
      type: row.type as MemoryEntry['type'],
      content: String(row.content),
      tags: JSON.parse(String(row.tags ?? '[]')) as string[],
      sessionId: row.session_id ? String(row.session_id) : undefined,
      createdAt: new Date(String(row.created_at)),
    }
  }

  // ---- Tasks ----
  addTask(task: Omit<Task, 'id' | 'children' | 'createdAt' | 'updatedAt'>): Task {
    const id = `T${Date.now()}`
    const now = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO tasks (id, parent_id, title, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, task.parentId ?? null, task.title, task.description ?? '', task.status, now, now)
    return { id, ...task, children: [], createdAt: new Date(now), updatedAt: new Date(now) }
  }

  updateTask(id: string, updates: Partial<Pick<Task, 'status' | 'title' | 'description'>>): void {
    const now = new Date().toISOString()
    if (updates.status)
      this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(updates.status, now, id)
    if (updates.title)
      this.db.prepare('UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?').run(updates.title, now, id)
    if (updates.description)
      this.db
        .prepare('UPDATE tasks SET description = ?, updated_at = ? WHERE id = ?')
        .run(updates.description, now, id)
  }

  getTasks(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all() as Array<
      Record<string, unknown>
    >
    const taskMap = new Map<string, Task>()
    const roots: Task[] = []
    for (const row of rows) {
      const task: Task = {
        id: String(row.id),
        parentId: row.parent_id ? String(row.parent_id) : undefined,
        title: String(row.title),
        description: String(row.description ?? ''),
        status: row.status as Task['status'],
        children: [],
        createdAt: new Date(String(row.created_at)),
        updatedAt: new Date(String(row.updated_at)),
      }
      taskMap.set(task.id, task)
      if (!task.parentId) roots.push(task)
    }
    // Build tree
    for (const task of taskMap.values()) {
      if (task.parentId) {
        taskMap.get(task.parentId)?.children.push(task)
      }
    }
    return roots
  }

  // ---- Markdown sync ----
  async syncToMarkdown(): Promise<void> {
    await fs.mkdir(this.memDir, { recursive: true })
    const entries = this.getAll()
    const facts = entries.filter((e) => e.type === 'fact')
    const notes = entries.filter((e) => e.type === 'note')
    const tasks = this.getTasks()

    const memoryMd = [
      '# Project Memory\n',
      '## Facts',
      ...facts.map((f) => `- ${f.content}`),
      '',
      '## Notes',
      ...notes.map((n) => `- ${n.content}`),
    ].join('\n')

    const tasksMd = ['# Tasks\n', ...tasks.map((t) => this.taskToMarkdown(t, 0))].join('\n')

    await fs.writeFile(path.join(this.memDir, 'MEMORY.md'), memoryMd, 'utf-8')
    await fs.writeFile(path.join(this.memDir, 'tasks.md'), tasksMd, 'utf-8')
  }

  private taskToMarkdown(task: Task, indent: number): string {
    const prefix = '  '.repeat(indent)
    const statusIcon = { pending: '☐', in_progress: '⏳', completed: '✅', failed: '❌' }[task.status]
    const lines = [`${prefix}- ${statusIcon} **${task.id}**: ${task.title}`]
    for (const child of task.children) {
      lines.push(this.taskToMarkdown(child, indent + 1))
    }
    return lines.join('\n')
  }

  async checkpoint(sessionId: string, summary: string): Promise<void> {
    const checkpointPath = path.join(this.memDir, 'checkpoint.md')
    const content = `# Checkpoint\n**Session:** ${sessionId}\n**Time:** ${new Date().toISOString()}\n\n${summary}\n`
    await fs.writeFile(checkpointPath, content, 'utf-8')
    this.addEntry({ type: 'checkpoint', content: summary, tags: ['checkpoint'], sessionId })
  }

  getBudgetedContext(maxTokens = 2000): string {
    const allEntries = this.getAll()
    let total = 0
    const selected: string[] = ['## Relevant Memory\n']
    for (const entry of allEntries) {
      const tokens = Math.ceil(entry.content.length / 4)
      if (total + tokens > maxTokens) break
      selected.push(`- [${entry.type}] ${entry.content}`)
      total += tokens
    }
    return selected.length > 1 ? selected.join('\n') : ''
  }

  close(): void {
    this.db.close()
  }
}

/**
 * Process-wide singleton keyed by project root. Prefer RuntimeContext.getMemory()
 * for per-run isolation; this helper remains for the CLI path.
 */
let _store: MemoryStore | null = null
let _storeCwd: string | null = null

export function getMemoryStore(projectRoot?: string): MemoryStore {
  if (!_store || (projectRoot && projectRoot !== _storeCwd)) {
    if (!projectRoot && !_store) throw new Error('projectRoot required on first call')
    _store = new MemoryStore(projectRoot as string)
    _storeCwd = projectRoot ?? _storeCwd
  }
  return _store
}
