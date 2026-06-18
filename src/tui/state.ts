// ============================================================
// FusionCode — TUI State (pure reducer, no React/Ink)
// Unit-testable state machine for the interactive terminal app.
// ============================================================

import { randomUUID } from 'crypto'
import type { AgentMode } from '../types/index.js'

export type TuiStatus = 'idle' | 'running' | 'cancelled' | 'error'

export const THEMES = ['default', 'ocean', 'sunset', 'forest'] as const
export type Theme = (typeof THEMES)[number]

export interface ToolEvent {
  kind: 'call' | 'result'
  /** Tool name on a call; the tool name this result belongs to on a result. */
  name: string
  args?: string
  result?: string
  isError?: boolean
}

export interface Turn {
  id: string
  role: 'user' | 'assistant'
  content: string
  tools: ToolEvent[]
  /** True while the assistant turn is still streaming. */
  streaming: boolean
}

export interface GitState {
  branch: string
  /** Number of changed files (0 = clean). */
  dirty: number
}

export interface TuiState {
  turns: Turn[]
  status: TuiStatus
  mode: AgentMode
  provider: string
  model: string
  git: GitState | null
  error: string | null
  showHelp: boolean
  /** First-launch banner shown until the first prompt is submitted. */
  showBanner: boolean
  /** Accumulator for in-flight assistant text tokens. */
  streamingText: string
  /** In-flight tool events for the active assistant turn. */
  currentTools: ToolEvent[]
  /** Active color theme (cycled by /theme). */
  theme: Theme
  /** Incremented on each mode change (Tab or /mode) to trigger the pill flash. */
  modeFlash: number
  /** Transient informational message shown above the prompt (cleared on submit). */
  info: string | null
  /** Whether the current provider is connected (has a key or is local). */
  connected: boolean
}

export type TuiAction =
  | { type: 'submit'; prompt: string }
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; args?: string }
  | { type: 'tool_result'; name: string; result: string; isError?: boolean }
  | { type: 'done'; content?: string }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }
  | { type: 'set_mode'; mode: AgentMode }
  | { type: 'set_provider'; provider: string }
  | { type: 'set_model'; model: string }
  | { type: 'clear' }
  | { type: 'toggle_help' }
  | { type: 'git'; git: GitState }
  | { type: 'set_theme'; theme: Theme }
  | { type: 'cycle_theme' }
  | { type: 'flash_mode' }
  | { type: 'set_info'; info: string | null }
  | { type: 'set_connected'; connected: boolean }

export function createInitialState(opts: {
  mode: AgentMode
  provider: string
  model: string
  connected?: boolean
}): TuiState {
  return {
    turns: [],
    status: 'idle',
    mode: opts.mode,
    provider: opts.provider,
    model: opts.model,
    git: null,
    error: null,
    showHelp: false,
    showBanner: true,
    streamingText: '',
    currentTools: [],
    theme: 'default',
    modeFlash: 0,
    info: null,
    connected: opts.connected ?? false,
  }
}

function finalizeAssistantTurn(state: TuiState, content: string): TuiState {
  const last = state.turns[state.turns.length - 1]
  // If the last turn is an in-flight assistant turn, finalize it.
  if (last && last.role === 'assistant' && last.streaming) {
    const finalized: Turn = { ...last, content, streaming: false }
    return {
      ...state,
      turns: [...state.turns.slice(0, -1), finalized],
      streamingText: '',
      currentTools: [],
    }
  }
  // No in-flight assistant turn: create one with the finalized content.
  if (content) {
    return {
      ...state,
      turns: [...state.turns, { id: randomUUID(), role: 'assistant', content, tools: [], streaming: false }],
      streamingText: '',
      currentTools: [],
    }
  }
  return { ...state, streamingText: '', currentTools: [] }
}

export function reducer(state: TuiState, action: TuiAction): TuiState {
  switch (action.type) {
    case 'submit': {
      const userTurn: Turn = {
        id: randomUUID(),
        role: 'user',
        content: action.prompt,
        tools: [],
        streaming: false,
      }
      // Seed an in-flight (empty) assistant turn so streaming text has a home.
      const assistantTurn: Turn = {
        id: randomUUID(),
        role: 'assistant',
        content: '',
        tools: [],
        streaming: true,
      }
      return {
        ...state,
        turns: [...state.turns, userTurn, assistantTurn],
        status: 'running',
        error: null,
        showBanner: false,
        info: null,
        streamingText: '',
        currentTools: [],
      }
    }

    case 'text': {
      const streamingText = state.streamingText + action.content
      return { ...state, streamingText }
    }

    case 'tool_call': {
      const event: ToolEvent = { kind: 'call', name: action.name, args: action.args }
      const currentTools = [...state.currentTools, event]
      return { ...state, currentTools }
    }

    case 'tool_result': {
      // Attach the result to the most recent call for this tool name.
      const currentTools = [...state.currentTools]
      for (let i = currentTools.length - 1; i >= 0; i--) {
        if (
          currentTools[i].kind === 'call' &&
          currentTools[i].name === action.name &&
          currentTools[i].result === undefined
        ) {
          currentTools[i] = { ...currentTools[i], result: action.result, isError: action.isError }
          break
        }
      }
      return { ...state, currentTools }
    }

    case 'done': {
      const content = action.content ?? state.streamingText
      return { ...state, ...finalizeAssistantTurn(state, content), status: 'idle' }
    }

    case 'cancelled': {
      const content = state.streamingText + (state.streamingText ? '\n\n[cancelled]' : '[cancelled]')
      return { ...state, ...finalizeAssistantTurn(state, content), status: 'cancelled' }
    }

    case 'error': {
      const content =
        state.streamingText +
        (state.streamingText ? `\n\n[error: ${action.message}]` : `[error: ${action.message}]`)
      return {
        ...state,
        ...finalizeAssistantTurn(state, content),
        status: 'error',
        error: action.message,
      }
    }

    case 'set_mode':
      return { ...state, mode: action.mode, modeFlash: state.modeFlash + 1 }

    case 'set_provider':
      return { ...state, provider: action.provider }

    case 'set_model':
      return { ...state, model: action.model }

    case 'clear':
      return { ...state, turns: [], error: null, status: 'idle', showBanner: false, info: null }

    case 'toggle_help':
      return { ...state, showHelp: !state.showHelp }

    case 'git':
      return { ...state, git: action.git }

    case 'set_theme':
      return { ...state, theme: action.theme }

    case 'cycle_theme': {
      const idx = THEMES.indexOf(state.theme)
      const next = THEMES[(idx + 1) % THEMES.length]
      return { ...state, theme: next }
    }

    case 'flash_mode':
      return { ...state, modeFlash: state.modeFlash + 1 }

    case 'set_info':
      return { ...state, info: action.info }

    case 'set_connected':
      return { ...state, connected: action.connected }

    default:
      return state
  }
}
