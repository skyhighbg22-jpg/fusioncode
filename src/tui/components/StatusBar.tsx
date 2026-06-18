import React from 'react'
import { Text, Box } from 'ink'
import type { TuiState } from '../state.js'

export function StatusBar({ state }: { state: TuiState }): React.ReactElement {
  const modeColor = state.mode === 'plan' || state.mode === 'review' ? 'cyan' : 'green'
  const git = state.git
    ? `  ·  ${state.git.branch}${state.git.dirty > 0 ? ` ±${state.git.dirty}` : ' clean'}`
    : ''
  const status =
    state.status === 'running'
      ? '  ·  working'
      : state.status === 'cancelled'
        ? '  ·  cancelled'
        : state.status === 'error'
          ? '  ·  error'
          : ''
  const statusColor = state.status === 'error' ? 'red' : state.status === 'cancelled' ? 'yellow' : 'gray'

  return (
    <Box>
      <Text color={modeColor} bold>
        {state.mode}
      </Text>
      <Text dimColor>
        {'  ·  '}
        {state.provider}/{state.model}
        {git}
        {status ? '  ·  ' : ''}
      </Text>
      {status ? <Text color={statusColor}>{state.status}</Text> : null}
      <Text dimColor>
        {'  ·  '}
        {state.turns.filter((t) => t.role === 'user').length} msgs
      </Text>
    </Box>
  )
}
