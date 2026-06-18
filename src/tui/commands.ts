// ============================================================
// FusionCode — TUI Slash Commands (pure parser, no React/Ink)
// ============================================================

import type { AgentMode } from '../types/index.js'

export const SLASH_COMMANDS = ['help', 'mode', 'model', 'provider', 'clear', 'status', 'exit'] as const
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
    | 'noop'
    | 'error'
  /** Value for set-mode/set-provider/set-model; prompt for run-agent. */
  value?: string
  /** Human-readable message for noop/error/show-status. */
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

    case 'unknown':
      return {
        kind: 'error',
        message: `Unknown command: /${parsed.args}. Type /help for available commands.`,
      }

    default:
      return { kind: 'noop' }
  }
}

/** The full /help reference text shown in the help overlay. */
export const HELP_TEXT = [
  'FusionCode — Commands',
  '',
  '  /help                  Show this help',
  '  /mode <name>           Switch mode: build | plan | debug | review | check',
  '  /model <name>          Override the model for the next run',
  '  /provider <name>       Switch provider',
  '  /clear                 Clear the conversation',
  '  /status                Show current config + git state',
  '  /exit                  Quit FusionCode',
  '',
  '  Type any other text to send it to the agent.',
  '  Press Esc to cancel an in-progress run.',
].join('\n')
