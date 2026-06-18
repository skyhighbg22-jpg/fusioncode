import React from 'react'
import { Box, Text } from 'ink'
import type { TuiState, Turn, ToolEvent } from '../state.js'
import { UserTurn } from './UserTurn.js'
import { AssistantTurn } from './AssistantTurn.js'

function TurnView({
  turn,
  streamingText,
  currentTools,
  username,
}: {
  turn: Turn
  streamingText: string
  currentTools: ToolEvent[]
  username: string
}): React.ReactElement {
  if (turn.role === 'user') return <UserTurn content={turn.content} username={username} />
  // Active streaming assistant turn: show live streamingText + currentTools.
  const isActive = turn.streaming
  return (
    <AssistantTurn
      content={isActive ? streamingText : turn.content}
      tools={isActive ? currentTools : turn.tools}
      streaming={isActive}
      finalized={!isActive}
      isError={false}
    />
  )
}

export function MessageList({ state, username }: { state: TuiState; username: string }): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {state.turns.map((turn) => (
        <TurnView
          key={turn.id}
          turn={turn}
          streamingText={state.streamingText}
          currentTools={state.currentTools}
          username={username}
        />
      ))}
      {state.info ? (
        <Box marginLeft={2} marginBottom={1}>
          <Text dimColor>{state.info}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
