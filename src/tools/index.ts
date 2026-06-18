// ============================================================
// FusionCode — Tool System (barrel + dispatch)
// Inspired by: OpenClaude tool stack, Aider git tools,
//              OpenCode tool definitions, Kilo MCP tools
// ============================================================

import type { Tool, ToolContext, ToolResult, FunctionToolSchema } from '../types/index.js'
import { bashTool } from './bash.js'
import { readFileTool, writeFileTool, editFileTool, globFilesTool, listDirTool } from './files.js'
import { grepTool } from './search.js'
import { webFetchTool, webSearchTool } from './web.js'
import { error } from './util.js'
import { toErrorMessage } from '../utils/errors.js'

export {
  bashTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  globFilesTool,
  listDirTool,
  grepTool,
  webFetchTool,
  webSearchTool,
}

export const ALL_TOOLS: Tool[] = [
  bashTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  globFilesTool,
  grepTool,
  listDirTool,
  webFetchTool,
  webSearchTool,
]

export const READONLY_TOOLS: Tool[] = [
  readFileTool,
  globFilesTool,
  grepTool,
  listDirTool,
  webFetchTool,
  webSearchTool,
]

export function getToolsForAgent(mode: string): Tool[] {
  if (mode === 'plan' || mode === 'review') return READONLY_TOOLS
  return ALL_TOOLS
}

export function toolsToOpenAISchema(tools: Tool[]): FunctionToolSchema[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  toolCallId: string,
): Promise<ToolResult> {
  const tool = ALL_TOOLS.find((t) => t.name === toolName)
  if (!tool) return { toolCallId, result: `Unknown tool: ${toolName}`, isError: true }
  try {
    const result = await tool.execute(args, ctx)
    return { ...result, toolCallId }
  } catch (e) {
    return { toolCallId, result: `Error executing ${toolName}: ${toErrorMessage(e)}`, isError: true }
  }
}

// Re-export for callers that build their own tool lists.
export { error as toolError }
