import React from 'react'
import { Text, Box } from 'ink'
import type { ToolEvent } from '../state.js'

function truncate(s: string, max: number): string {
  const oneLine = s.replace(/\n/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine
}

function ToolView({ event }: { event: ToolEvent }): React.ReactElement {
  if (event.kind === 'call') {
    const argPreview = event.args ? truncate(event.args, 50) : ''
    return (
      <Box marginLeft={2}>
        <Text color="yellow">⏺ </Text>
        <Text bold>{event.name}</Text>
        {argPreview ? <Text dimColor>({argPreview})</Text> : null}
      </Box>
    )
  }
  return (
    <Box marginLeft={4} flexDirection="column">
      <Text dimColor>⎿ {truncate(event.result ?? '', 80)}</Text>
      {event.isError ? <Text color="red"> (error)</Text> : null}
    </Box>
  )
}

interface AssistantTurnProps {
  content: string
  tools: ToolEvent[]
  streaming: boolean
}

export function AssistantTurn({ content, tools, streaming }: AssistantTurnProps): React.ReactElement {
  const hasContent = content.trim().length > 0
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="magenta" bold>
        ◆{' '}
      </Text>
      {tools.map((t, i) => (
        <ToolView key={i} event={t} />
      ))}
      {hasContent ? (
        <Box marginLeft={2}>
          <Text>{content}</Text>
          {streaming ? <Text dimColor> ▋</Text> : null}
        </Box>
      ) : streaming ? (
        <Box marginLeft={2}>
          <Text dimColor>thinking…</Text>
        </Box>
      ) : null}
    </Box>
  )
}
