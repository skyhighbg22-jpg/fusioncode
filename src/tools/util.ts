// ============================================================
// FusionCode — Tool Helpers
// Shared result constructors and limits used across tools.
// ============================================================

import type { ToolResult } from '../types/index.js'
import { toErrorMessage } from '../utils/errors.js'

/** Max characters of output a single tool call may return. */
export const MAX_TOOL_OUTPUT = 30_000

/** Default glob ignore patterns for filesystem search tools. */
export const DEFAULT_IGNORE = ['node_modules/**', 'dist/**', 'build/**', '.git/**']

export function ok(result: string): ToolResult {
  return { toolCallId: '', result }
}

export function error(message: string): ToolResult {
  return { toolCallId: '', result: message, isError: true }
}

/** Wrap an async tool body in the standard try/catch → ToolResult shape. */
export async function runTool(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn()
  } catch (e) {
    return error(`Error: ${toErrorMessage(e)}`)
  }
}

/** Truncate a string to `max` chars, appending a notice when truncated. */
export function truncate(text: string, max = MAX_TOOL_OUTPUT): string {
  if (text.length <= max) return text
  return text.slice(0, max) + `\n...(truncated, ${text.length - max} more characters)`
}
