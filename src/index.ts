// ============================================================
// FusionCode — Library Barrel
// Programmatic entry point for using FusionCode as a library.
// ============================================================

// Agent runner + swarm
export { AgentRunner, createAgent, runSwarm } from './agents/index.js'
export type { RunOptions } from './agents/index.js'

// Mode strategies
export {
  getMode,
  listAgentModes,
  BuildMode,
  DebugMode,
  PlanMode,
  ReviewMode,
  CheckMode,
} from './agents/modes/index.js'
export type { ModeStrategy, RunContext } from './agents/modes/index.js'

// Providers
export { BaseProvider, createProvider, registerProvider, listProviders } from './providers/base.js'
export { OpenAICompatibleProvider, PROVIDER_PRESETS } from './providers/openai-compatible.js'

// Tools
export {
  ALL_TOOLS,
  READONLY_TOOLS,
  getToolsForAgent,
  toolsToOpenAISchema,
  executeTool,
  bashTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  globFilesTool,
  grepTool,
  listDirTool,
  webFetchTool,
  webSearchTool,
} from './tools/index.js'

// Memory + git
export { MemoryStore, getMemoryStore } from './memory/index.js'
export { GitManager, getGitManager } from './git/index.js'

// Config + runtime
export { loadConfig, saveConfig, getProviderConfig, listProviderNames, deepMerge } from './config/index.js'
export { RuntimeContext } from './runtime/context.js'
export type { RuntimeContextOptions } from './runtime/context.js'

// Logger
export { logger, setLogLevel, getLogLevel } from './logger/index.js'
export type { Logger, LogLevel } from './logger/index.js'

// Types
export type * from './types/index.js'
