import React, { useReducer, useEffect, useCallback } from 'react'
import { useApp, useInput, render as inkRender, Box } from 'ink'
import { RuntimeContext } from '../runtime/context.js'
import { getMode } from '../agents/modes/index.js'
import { saveConfig } from '../config/index.js'
import { PROVIDER_PRESETS } from '../providers/openai-compatible.js'
import { createInitialState, reducer } from './state.js'
import type { AgentMode } from '../types/index.js'
import {
  parseSlashCommand,
  evalCommand,
  MODELS_SENTINEL,
  PROVIDERS_SENTINEL,
  VERSION_SENTINEL,
} from './commands.js'
import { useAgent } from './hooks/useAgent.js'
import { Banner } from './components/Banner.js'
import { StatusBar } from './components/StatusBar.js'
import { MessageList } from './components/MessageList.js'
import { Prompt } from './components/Prompt.js'
import { HelpOverlay } from './components/HelpOverlay.js'
import { userInfo } from 'os'

const VERSION = '0.1.0'
const USERNAME = userInfo().username
const MODE_ORDER: AgentMode[] = ['build', 'plan', 'debug', 'review', 'check']

/** A provider is "connected" if it has a non-empty apiKey OR serves localhost. */
function isProviderConnected(baseUrl: string, apiKey?: string): boolean {
  if (apiKey && apiKey.trim()) return true
  return /localhost|127\.0\.0\.1/i.test(baseUrl)
}

interface AppProps {
  runtime: RuntimeContext
}

function App({ runtime }: AppProps): React.ReactElement {
  const config = runtime.config
  const initialProvider = config.defaultProvider
  const initialProviderCfg = config.providers[initialProvider]
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialState({
      mode: config.defaultAgent,
      provider: initialProvider,
      model: initialProviderCfg?.model ?? '',
      connected: initialProviderCfg
        ? isProviderConnected(initialProviderCfg.baseUrl, initialProviderCfg.apiKey)
        : false,
    }),
  )

  const { submit, cancel } = useAgent(runtime, state.mode, state.provider, state.model, dispatch)
  const { exit } = useApp()

  // Recompute connected whenever provider or its config changes.
  useEffect(() => {
    const pcfg = config.providers[state.provider]
    if (pcfg) dispatch({ type: 'set_connected', connected: isProviderConnected(pcfg.baseUrl, pcfg.apiKey) })
  }, [config, state.provider])

  // Poll git state once on mount and after each idle transition.
  useEffect(() => {
    let cancelled = false
    const refresh = async (): Promise<void> => {
      try {
        const git = runtime.getGit()
        if (!(await git.isGitRepo())) return
        const branch = await git.currentBranch()
        const diff = await git.diff()
        if (!cancelled) dispatch({ type: 'git', git: { branch, dirty: diff.files.length } })
      } catch {
        // Not a git repo or git unavailable — leave git state null.
      }
    }
    void refresh()
    return () => {
      cancelled = true
    }
  }, [runtime, state.status])

  // Build rich info messages for /models, /providers, /version.
  const buildInfoMessage = (sentinel: string): string => {
    if (sentinel === VERSION_SENTINEL) {
      return `FusionCode v${VERSION} · mode=${state.mode} · provider=${state.provider} · model=${state.model}`
    }
    if (sentinel === MODELS_SENTINEL) {
      const preset = PROVIDER_PRESETS[state.provider]
      const lines = [`Models for ${state.provider}:`]
      if (preset) lines.push(`  preset default: ${preset.model}`)
      const cfg = config.providers[state.provider]
      if (cfg) lines.push(`  configured:      ${cfg.model}`)
      lines.push('  (override with /model <name>)')
      return lines.join('\n')
    }
    if (sentinel === PROVIDERS_SENTINEL) {
      const lines = ['Providers:']
      for (const [name, pcfg] of Object.entries(config.providers)) {
        const conn = isProviderConnected(pcfg.baseUrl, pcfg.apiKey)
        const active = name === state.provider ? ' (active)' : ''
        lines.push(`  ${conn ? '✓' : '✗'} ${name}: ${pcfg.model}${active}`)
      }
      return lines.join('\n')
    }
    return sentinel
  }

  const handleSubmit = useCallback(
    (value: string) => {
      const parsed = parseSlashCommand(value)
      if (parsed) {
        const result = evalCommand(parsed)
        switch (result.kind) {
          case 'toggle-help':
            dispatch({ type: 'toggle_help' })
            return
          case 'set-mode':
            try {
              getMode(result.value!)
              dispatch({ type: 'set_mode', mode: result.value as AgentMode })
            } catch {
              /* invalid mode already validated by evalCommand */
            }
            return
          case 'set-provider': {
            const name = result.value!
            if (!config.providers[name]) {
              dispatch({ type: 'set_info', info: `Unknown provider '${name}'. Try /providers.` })
              return
            }
            dispatch({ type: 'set_provider', provider: name })
            dispatch({ type: 'set_model', model: config.providers[name].model })
            return
          }
          case 'set-model':
            dispatch({ type: 'set_model', model: result.value! })
            return
          case 'clear':
            dispatch({ type: 'clear' })
            return
          case 'show-status':
            dispatch({ type: 'set_info', info: buildInfoMessage(VERSION_SENTINEL) })
            return
          case 'exit':
            exit()
            return
          case 'connect': {
            const providerName = result.value!
            const pcfg = config.providers[providerName]
            if (!pcfg) {
              dispatch({ type: 'set_info', info: `Unknown provider '${providerName}'. Try /providers.` })
              return
            }
            const key = result.value2
            if (key) {
              pcfg.apiKey = key
              try {
                saveConfig(config)
              } catch {
                /* save failure is non-fatal for the session */
              }
              dispatch({ type: 'set_connected', connected: isProviderConnected(pcfg.baseUrl, pcfg.apiKey) })
              dispatch({ type: 'set_info', info: `✓ Connected ${providerName} (key saved).` })
            } else {
              dispatch({ type: 'set_info', info: `Usage: /connect ${providerName} <key>` })
            }
            return
          }
          case 'disconnect': {
            const pcfg = config.providers[state.provider]
            if (pcfg) {
              pcfg.apiKey = ''
              try {
                saveConfig(config)
              } catch {
                /* ignore */
              }
              dispatch({ type: 'set_connected', connected: isProviderConnected(pcfg.baseUrl, pcfg.apiKey) })
              dispatch({ type: 'set_info', info: `Disconnected ${state.provider}.` })
            }
            return
          }
          case 'show-message':
            dispatch({ type: 'set_info', info: buildInfoMessage(result.message!) })
            return
          case 'retry': {
            const lastUser = [...state.turns].reverse().find((t) => t.role === 'user')
            if (!lastUser) {
              dispatch({ type: 'set_info', info: 'Nothing to retry.' })
              return
            }
            void submit(lastUser.content)
            return
          }
          case 'cycle-theme':
            dispatch({ type: 'cycle_theme' })
            return
          case 'error':
            dispatch({ type: 'set_info', info: result.message ?? 'error' })
            return
          default:
            return
        }
      }
      void submit(value)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exit, state.mode, state.provider, state.turns, submit, config],
  )

  // Global key handling: Esc cancels a run; Tab cycles modes.
  useInput((_input, key) => {
    if (key.escape && state.status === 'running') {
      cancel()
    } else if (key.tab && state.status !== 'running') {
      const idx = MODE_ORDER.indexOf(state.mode)
      const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length]
      dispatch({ type: 'set_mode', mode: next })
    }
  })

  return (
    <Box flexDirection="column" height="100%">
      {state.showBanner ? <Banner version={VERSION} /> : null}
      {state.showHelp ? <HelpOverlay /> : null}
      <MessageList state={state} username={USERNAME} />
      <Prompt running={state.status === 'running'} connected={state.connected} onSubmit={handleSubmit} />
      <StatusBar state={state} />
    </Box>
  )
}

/**
 * Launch the interactive TUI. Silences the logger (which writes to stderr and
 * would corrupt Ink's raw-mode screen) and restores it on exit. Falls back to
 * a plain message if Ink's native dependency (yoga-layout) fails to load.
 */
export async function launchTui(runtime?: RuntimeContext): Promise<void> {
  // Ink needs an interactive TTY for raw-mode keyboard input. Bail early with
  // a helpful message when stdin isn't a TTY (piped input, CI, etc.) so the
  // user gets guidance instead of a raw-mode stack trace.
  if (!process.stdin.isTTY) {
    console.error('FusionCode interactive mode requires an interactive terminal (TTY).')
    console.error('To run non-interactively, use:  fusion run "<your prompt>"')
    return
  }

  const rt = runtime ?? new RuntimeContext({ cwd: process.cwd() })

  // Import logger lazily so this module stays importable even if logger fails.
  const { setLogLevel, getLogLevel } = await import('../logger/index.js')
  const previousLevel = getLogLevel()
  setLogLevel('silent')

  // Clear the screen (and scrollback) so any shell startup banner — e.g. the
  // PowerShell "Windows PowerShell / Copyright ..." block — is wiped before
  // the TUI takes over, leaving only the FUSION interface visible.
  // Clear the screen (and scrollback) so any shell startup banner — e.g. the
  // PowerShell "Windows PowerShell / Copyright ..." block — is wiped before
  // the TUI takes over, leaving only the FUSION interface visible.
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H')

  // Set the terminal tab title to "fusion" while the TUI is running (OSC 0).
  process.stdout.write('\x1B]0;fusion\x07')

  try {
    const { waitUntilExit } = inkRender(<App runtime={rt} />)
    await waitUntilExit()
  } catch (e) {
    // yoga-layout load failure or other render error — print a clear message.
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`Could not launch interactive UI: ${msg}`)
    console.error('Run \`fusion run "<prompt>"\` for the one-shot mode instead.')
  } finally {
    setLogLevel(previousLevel)
    // Restore the tab title to the current shell/directory on exit.
    process.stdout.write('\x1B]0;\x07')
  }
}
