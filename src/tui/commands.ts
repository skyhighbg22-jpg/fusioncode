// ============================================================
// FusionCode — TUI Slash Commands (pure parser, no React/Ink)
// ============================================================

import type { AgentMode } from '../types/index.js'

export const SLASH_COMMANDS = [
  'help',
  'mode',
  'model',
  'provider',
  'clear',
  'status',
  'exit',
  'connect',
  'disconnect',
  'models',
  'providers',
  'retry',
  'theme',
  'version',
] as const
export type SlashCommandName = (typeof SLASH_COMMANDS)[number]

const VALID_MODES: AgentMode[] = ['build', 'plan', 'debug', 'review', 'check']

export interface ParsedCommand {
  /** The command name without the leading slash. */
  command: SlashCommandName
  /** The raw argument string after the command name (trimmed). */
  args: string
}

/**
 * Parse a user input line as a slash command.
 * Returns `null` when the line is not a slash command (so the caller can send
 * it to the agent as a normal prompt). Returns a ParsedCommand for known
 * commands. Unknown `/foo` lines return a ParsedCommand with command set to
 * an `'unknown'` sentinel so the UI can show a friendly error.
 */
export function parseSlashCommand(
  line: string,
): { command: SlashCommandName | 'unknown'; args: string } | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('/')) return null

  const spaceIdx = trimmed.indexOf(' ')
  const name = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase()
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()

  if ((SLASH_COMMANDS as readonly string[]).includes(name)) {
    return { command: name as SlashCommandName, args }
  }
  return { command: 'unknown', args: name }
}

export interface CommandResult {
  /** What kind of action the UI should take. */
  kind:
    | 'run-agent'
    | 'set-mode'
    | 'set-provider'
    | 'set-model'
    | 'clear'
    | 'toggle-help'
    | 'show-status'
    | 'exit'
    | 'connect'
    | 'disconnect'
    | 'show-message'
    | 'retry'
    | 'cycle-theme'
    | 'noop'
    | 'error'
  /** Value for set-mode/set-provider/set-model; provider for connect; prompt for run-agent. */
  value?: string
  /** Second value (e.g. API key for connect). */
  value2?: string
  /** Human-readable message for noop/error/show-message. */
  message?: string
}

const MODE_HELP = `Valid modes: ${VALID_MODES.join(', ')}. Usage: /mode <name>`

/**
 * Evaluate a parsed slash command into a UI action. Pure: no side effects.
 */
export function evalCommand(parsed: { command: SlashCommandName | 'unknown'; args: string }): CommandResult {
  switch (parsed.command) {
    case 'help':
      return { kind: 'toggle-help' }

    case 'mode': {
      if (!parsed.args) return { kind: 'error', message: MODE_HELP }
      if (!(VALID_MODES as readonly string[]).includes(parsed.args)) {
        return { kind: 'error', message: `Unknown mode '${parsed.args}'. ${MODE_HELP}` }
      }
      return { kind: 'set-mode', value: parsed.args }
    }

    case 'model': {
      if (!parsed.args) return { kind: 'error', message: 'Usage: /model <name>' }
      return { kind: 'set-model', value: parsed.args }
    }

    case 'provider': {
      if (!parsed.args) return { kind: 'error', message: 'Usage: /provider <name>' }
      return { kind: 'set-provider', value: parsed.args }
    }

    case 'clear':
      return { kind: 'clear' }

    case 'status':
      return { kind: 'show-status', message: 'status' }

    case 'exit':
      return { kind: 'exit' }

    case 'connect': {
      // /connect <provider> [key]
      const parts = parsed.args.split(/\s+/)
      if (!parts[0]) return { kind: 'error', message: 'Usage: /connect <provider> [key]' }
      return { kind: 'connect', value: parts[0], value2: parts.slice(1).join(' ') || undefined }
    }

    case 'disconnect':
      return { kind: 'disconnect' }

    case 'models':
      // The message is built by the App (it has access to config); signal here.
      return { kind: 'show-message', message: '__models__' }

    case 'providers':
      return { kind: 'show-message', message: '__providers__' }

    case 'retry':
      return { kind: 'retry' }

    case 'theme':
      return { kind: 'cycle-theme' }

    case 'version':
      return { kind: 'show-message', message: '__version__' }

    case 'unknown':
      return {
        kind: 'error',
        message: `Unknown command: /${parsed.args}. Type /help for available commands.`,
      }

    default:
      return { kind: 'noop' }
  }
}

/** Sentinel messages the App resolves into rich content (models/providers/version). */
export const MODELS_SENTINEL = '__models__'
export const PROVIDERS_SENTINEL = '__providers__'
export const VERSION_SENTINEL = '__version__'

/** The full /help reference text shown in the help overlay. */
export const HELP_TEXT = [
  'FusionCode — Commands',
  '',
  '  /help                  Show this help',
  '  /mode <name>           Switch mode: build | plan | debug | review | check',
  '  /model <name>          Override the model for the next run',
  '  /provider <name>       Switch provider',
  '  /connect <p> [key]     Connect a provider (set its API key)',
  '  /disconnect            Clear the current provider key',
  '  /models                List models for the current provider',
  '  /providers             List all providers + connection status',
  '  /retry                 Re-run the last prompt',
  '  /theme                 Cycle color theme',
  '  /version               Show version info',
  '  /clear                 Clear the conversation',
  '  /status                Show current config + git state',
  '  /exit                  Quit FusionCode',
  '',
  '  Type any other text to send it to the agent.',
  '  Press Tab to cycle modes · Esc to cancel a run.',
].join('\n')
