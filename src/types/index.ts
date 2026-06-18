// ============================================================
// FusionCode — Core Types
// ============================================================

export type AgentMode = 'build' | 'plan' | 'debug' | 'review' | 'check'

export interface ProviderConfig {
  name: string
  baseUrl: string
  apiKey?: string
  model: string
  maxTokens?: number
  temperature?: number
  headers?: Record<string, string>
}

export interface FusionConfig {
  defaultAgent: AgentMode
  defaultProvider: string
  providers: Record<string, ProviderConfig>
  memory: MemoryConfig
  git: GitConfig
  server: ServerConfig
  checks: CheckConfig[]
}

export interface MemoryConfig {
  enabled: boolean
  dir: string
  maxTokensBudget: number
  autoCheckpoint: boolean
  checkpointInterval: number
}

export interface GitConfig {
  autoCommit: boolean
  commitMessagePrefix: string
  showDiff: boolean
  requireClean: boolean
}

export interface ServerConfig {
  enabled: boolean
  port: number
  host: string
  auth?: string
}

export interface CheckConfig {
  name: string
  file: string
  agent: AgentMode
  provider?: string
  auto: boolean
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | ContentBlock[]
  toolCalls?: ToolCall[]
  toolCallId?: string
}

export interface ContentBlock {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolResult {
  toolCallId: string
  result: string
  isError?: boolean
}

export interface AgentSession {
  id: string
  agent: AgentMode
  provider: string
  model: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  taskId?: string
}

export interface Task {
  id: string
  parentId?: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  children: Task[]
  createdAt: Date
  updatedAt: Date
}

export interface MemoryEntry {
  id: string
  type: 'fact' | 'checkpoint' | 'note' | 'skill'
  content: string
  tags: string[]
  createdAt: Date
  sessionId?: string
}

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>
}

export interface ToolContext {
  cwd: string
  sessionId: string
  agent: AgentMode
  readonly: boolean
}

export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error'
  content?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
  error?: string
}

export interface GitDiff {
  files: string[]
  additions: number
  deletions: number
  diff: string
}

/** JSON-schema function-tool definition (structurally compatible with
 *  OpenAI's ChatCompletionTool). Used by the tool system and providers. */
export interface FunctionToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}
