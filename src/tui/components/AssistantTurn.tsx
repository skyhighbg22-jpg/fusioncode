import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import Spinner from 'ink-spinner'
import type { ToolEvent } from '../state.js'

function truncate(s: string, max: number): string {
  const oneLine = s.replace(/\n/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine
}

/** Slide-in: a new tool call animates marginLeft 0→2 over ~80ms. */
function ToolView({ event, dim }: { event: ToolEvent; dim: boolean }): React.ReactElement {
  const [slid, setSlid] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlid(true), 80)
    return () => clearTimeout(id)
  }, [])

  if (event.kind === 'call') {
    const argPreview = event.args ? truncate(event.args, 50) : ''
    return (
      <Box marginLeft={slid ? 2 : 0}>
        <Text color="yellow" dimColor={dim}>
          ⏺{' '}
        </Text>
        <Text bold dimColor={dim}>
          {event.name}
        </Text>
        {argPreview ? <Text dimColor>({argPreview})</Text> : null}
      </Box>
    )
  }
  return (
    <Box marginLeft={4}>
      <Text dimColor>⎿ {truncate(event.result ?? '', 80)}</Text>
      {event.isError ? <Text color="red"> (error)</Text> : null}
    </Box>
  )
}

/** Blinking block cursor that toggles every 500ms while streaming. */
function useBlinkingCursor(active: boolean): boolean {
  const [on, setOn] = useState(true)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setOn((v) => !v), 500)
    return () => clearInterval(id)
  }, [active])
  return active && on
}

/** Fade-in: start dim, brighten after a short delay on first render. */
function useFadeIn(): boolean {
  const [bright, setBright] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setBright(true), 150)
    return () => clearTimeout(id)
  }, [])
  return bright
}

/** Success ✓ pop: show a green check that "pops" for 250ms when a turn finalizes cleanly. */
function useSuccessPop(finalized: boolean, isError: boolean): boolean {
  const [popped, setPopped] = useState(false)
  useEffect(() => {
    if (!finalized || isError) return
    setPopped(true)
    const id = setTimeout(() => setPopped(false), 250)
    return () => clearTimeout(id)
  }, [finalized, isError])
  return popped
}

/** Error flash: toggle red↔brightRed twice (500ms total) when an error is present. */
function useErrorFlash(isError: boolean): 'red' | 'redBright' {
  const [bright, setBright] = useState(false)
  useEffect(() => {
    if (!isError) return
    setBright(true)
    const id = setInterval(() => setBright((v) => !v), 250)
    const stop = setTimeout(() => clearInterval(id), 500)
    return () => {
      clearInterval(id)
      clearTimeout(stop)
    }
  }, [isError])
  return isError && bright ? 'redBright' : 'red'
}

interface AssistantTurnProps {
  content: string
  tools: ToolEvent[]
  streaming: boolean
  /** True once the turn has finalized (done/cancelled/error). */
  finalized?: boolean
  /** True if the turn ended in an error. */
  isError?: boolean
}

export function AssistantTurn({
  content,
  tools,
  streaming,
  finalized = false,
  isError = false,
}: AssistantTurnProps): React.ReactElement {
  const bright = useFadeIn()
  const cursorOn = useBlinkingCursor(streaming)
  const popped = useSuccessPop(finalized, isError)
  const errorColor = useErrorFlash(finalized && isError)
  const hasContent = content.trim().length > 0
  const dim = !bright

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="magenta" bold dimColor={dim}>
        ◆ {popped ? <Text color="green">✓</Text> : null}
      </Text>
      {tools.map((t, i) => (
        <ToolView key={i} event={t} dim={dim} />
      ))}
      {hasContent ? (
        <Box marginLeft={2}>
          <Text color={finalized && isError ? errorColor : undefined} dimColor={dim}>
            {content}
          </Text>
          {streaming ? <Text color="cyan">{cursorOn ? '▋' : ' '}</Text> : null}
        </Box>
      ) : streaming ? (
        <Box marginLeft={2}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text dimColor> thinking…</Text>
        </Box>
      ) : null}
    </Box>
  )
}
