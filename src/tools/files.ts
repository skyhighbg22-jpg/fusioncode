// ============================================================
// FusionCode — Filesystem Tools
// read_file / write_file / edit_file / list_dir / glob_files
// ============================================================

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import type { Tool } from '../types/index.js'
import { DEFAULT_IGNORE, error, ok, runTool } from './util.js'

// ---- read_file ----
export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file. start_line/end_line are 1-indexed and inclusive.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      start_line: { type: 'number', description: 'Start line (1-indexed inclusive, optional)' },
      end_line: { type: 'number', description: 'End line (1-indexed inclusive, optional)' },
    },
    required: ['path'],
  },
  async execute(args, ctx) {
    return runTool(async () => {
      const filePath = path.resolve(ctx.cwd, String(args.path))
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const startLine = Number(args.start_line ?? 1)
      const endLine = Number(args.end_line ?? lines.length)
      // 1-indexed inclusive → 0-indexed exclusive slice: [start-1, end)
      const start = Math.max(0, startLine - 1)
      const end = Math.min(lines.length, endLine)
      if (end < start) return error('end_line must be >= start_line.')

      const selected = lines.slice(start, end).join('\n')
      return ok(selected)
    })
  },
}

// ---- write_file ----
export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write content to a file. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  async execute(args, ctx) {
    if (ctx.readonly) return error('ERROR: write_file is disabled in plan/review mode.')
    return runTool(async () => {
      const filePath = path.resolve(ctx.cwd, String(args.path))
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, String(args.content), 'utf-8')
      return ok(`Written ${filePath}`)
    })
  },
}

// ---- edit_file ----
export const editFileTool: Tool = {
  name: 'edit_file',
  description: 'Replace the first occurrence of old_string with new_string in a file.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      old_string: { type: 'string', description: 'Exact string to replace' },
      new_string: { type: 'string', description: 'Replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute(args, ctx) {
    if (ctx.readonly) return error('ERROR: edit_file is disabled in plan/review mode.')
    return runTool(async () => {
      const filePath = path.resolve(ctx.cwd, String(args.path))
      const content = await fs.readFile(filePath, 'utf-8')
      const oldString = String(args.old_string)
      if (!content.includes(oldString)) {
        return error('Error: old_string not found in file.')
      }
      const updated = content.replace(oldString, String(args.new_string))
      await fs.writeFile(filePath, updated, 'utf-8')
      return ok(`Edited ${filePath}`)
    })
  },
}

// ---- glob_files ----
export const globFilesTool: Tool = {
  name: 'glob_files',
  description: 'Find files matching a glob pattern.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. src/**/*.ts)' },
      ignore: { type: 'array', items: { type: 'string' }, description: 'Patterns to ignore' },
    },
    required: ['pattern'],
  },
  async execute(args, ctx) {
    return runTool(async () => {
      const files = await glob(String(args.pattern), {
        cwd: ctx.cwd,
        ignore: (args.ignore as string[]) ?? DEFAULT_IGNORE,
        absolute: false,
      })
      return ok(files.join('\n') || '(no files found)')
    })
  },
}

// ---- list_dir ----
export const listDirTool: Tool = {
  name: 'list_dir',
  description: 'List the contents of a directory.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path (default: .)' },
    },
  },
  async execute(args, ctx) {
    return runTool(async () => {
      const dirPath = path.resolve(ctx.cwd, String(args.path ?? '.'))
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const lines = entries
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .map((e) => `${e.isDirectory() ? 'd' : 'f'}  ${e.name}${e.isDirectory() ? '/' : ''}`)
      return ok(lines.join('\n') || '(empty directory)')
    })
  },
}
