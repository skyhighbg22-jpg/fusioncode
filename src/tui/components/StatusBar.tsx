import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import type { TuiState } from '../state.js'

/** Pulse: toggle dim↔bright every 600ms while running. Returns true=dim. */
function usePulse(active: boolean): boolean {
  const [dim, setDim] = useState(false)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setDim((v) => !v), 600)
    return () => clearInterval(id)
  }, [active])
  return active ? dim : false
}

/** Mode-pill flash: bright for 400ms when modeFlash changes. */
function useModeFlash(modeFlash: number): boolean {
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (modeFlash === 0) return
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 400)
    return () => clearTimeout(id)
  }, [modeFlash])
  return flash
}

export function StatusBar({ state }: { state: TuiState }): React.ReactElement {
  const pulsing = state.status === 'running'
  const dim = usePulse(pulsing)
  const flash = useModeFlash(state.modeFlash)

  const modeColor = state.mode === 'plan' || state.mode === 'review' ? 'cyan' : 'green'
  const readonly = state.mode === 'plan' || state.mode === 'review'
  const git = state.git ? ` ${state.git.branch}${state.git.dirty > 0 ? ` ±${state.git.dirty}` : ' ✓'}` : ''
  const status =
    state.status === 'running'
      ? 'working'
      : state.status === 'cancelled'
        ? 'cancelled'
        : state.status === 'error'
          ? 'error'
          : null
  const statusColor = state.status === 'error' ? 'red' : state.status === 'cancelled' ? 'yellow' : 'cyan'

  // Left: provider/model (or "not connected") · git · msg count
  // Right: status + mode pill (lower-right, OpenCode-style; flashes on Tab)
  return (
    <Box justifyContent="space-between">
      <Box>
        {state.connected ? (
          <Text dimColor={dim}>
            {state.provider}/{state.model}
          </Text>
        ) : (
          <Text color="red" dimColor={dim}>
            not connected
          </Text>
        )}
        {git ? <Text dimColor={dim}>{git}</Text> : null}
        <Text dimColor={dim}>
          {'  '}
          {state.turns.filter((t) => t.role === 'user').length} msgs
        </Text>
      </Box>
      <Box>
        {status ? (
          <Box marginRight={2}>
            <Text color={statusColor} dimColor={dim && pulsing}>
              {status}
            </Text>
          </Box>
        ) : null}
        <Text color={modeColor} bold={flash} dimColor={dim && pulsing && !flash}>
          [{state.mode}
          {readonly ? '/ro' : ''}]
        </Text>
      </Box>
    </Box>
  )
}
