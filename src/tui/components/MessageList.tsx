import React from 'react'
import { Box } from 'ink'
import type { TuiState, Turn } from '../state.js'
import { UserTurn } from './UserTurn.js'
import { AssistantTurn } from './AssistantTurn.js'

function TurnView({
  turn,
  streamingText,
  currentTools,
}: {
  turn: Turn
  streamingText: string
  currentTools: ToolEvent[]
}): React.ReactElement {
  if (turn.role === 'user') return <UserTurn content={turn.content} />
  // Active streaming assistant turn: show live streamingText + currentTools.
  const isActive = turn.streaming
  return (
    <AssistantTurn
      content={isActive ? streamingText : turn.content}
      tools={isActive ? currentTools : turn.tools}
      streaming={isActive}
    />
  )
}

// Re-import the type locally to avoid a circular-feeling import; it's the same type.
import type { ToolEvent } from '../state.js'

export function MessageList({ state }: { state: TuiState }): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {state.turns.map((turn) => (
        <TurnView
          key={turn.id}
          turn={turn}
          streamingText={state.streamingText}
          currentTools={state.currentTools}
        />
      ))}
    </Box>
  )
}
