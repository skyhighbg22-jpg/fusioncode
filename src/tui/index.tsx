import React, { useReducer, useEffect, useCallback } from 'react'
import { useApp, useInput, render as inkRender, Box } from 'ink'
import { RuntimeContext } from '../runtime/context.js'
import { getMode } from '../agents/modes/index.js'
import { createInitialState, reducer } from './state.js'
import { parseSlashCommand, evalCommand } from './commands.js'
import { useAgent } from './hooks/useAgent.js'
import { Banner } from './components/Banner.js'
import { StatusBar } from './components/StatusBar.js'
import { MessageList } from './components/MessageList.js'
import { Prompt } from './components/Prompt.js'
import { HelpOverlay } from './components/HelpOverlay.js'

const VERSION = '0.1.0'

interface AppProps {
  runtime: RuntimeContext
}

function App({ runtime }: AppProps): React.ReactElement {
  const config = runtime.config
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialState({
      mode: config.defaultAgent,
      provider: config.defaultProvider,
      model: config.providers[config.defaultProvider]?.model ?? '',
    }),
  )

  const { submit, cancel } = useAgent(runtime, state.mode, state.provider, state.model, dispatch)
  const { exit } = useApp()

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
              dispatch({ type: 'set_mode', mode: result.value as typeof state.mode })
            } catch {
              /* invalid mode already validated by evalCommand */
            }
            return
          case 'set-provider':
            dispatch({ type: 'set_provider', provider: result.value! })
            return
          case 'set-model':
            dispatch({ type: 'set_model', model: result.value! })
            return
          case 'clear':
            dispatch({ type: 'clear' })
            return
          case 'show-status':
            // Status is already visible in the status bar; no-op.
            return
          case 'exit':
            exit()
            return
          case 'error':
            dispatch({ type: 'error', message: result.message ?? 'error' })
            return
          default:
            return
        }
      }
      void submit(value)
    },
    [exit, state.mode, submit],
  )

  // Global key handling: Esc cancels a run, Ctrl+C exits.
  useInput((input, key) => {
    if (key.escape && state.status === 'running') {
      cancel()
    }
  })

  return (
    <Box flexDirection="column" height="100%">
      {state.showBanner ? <Banner version={VERSION} /> : null}
      {state.showHelp ? <HelpOverlay /> : null}
      <MessageList state={state} />
      <Prompt running={state.status === 'running'} onSubmit={handleSubmit} />
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
  }
}
