import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import TextInput from 'ink-text-input'
import Spinner from 'ink-spinner'

interface PromptProps {
  running: boolean
  connected: boolean
  onSubmit: (value: string) => void
}

/** Border glow: while idle, cycle gray↔cyan every 800ms to indicate focus. */
function useBorderGlow(running: boolean): 'gray' | 'cyan' {
  const [glow, setGlow] = useState(false)
  useEffect(() => {
    if (running) return
    const id = setInterval(() => setGlow((v) => !v), 800)
    return () => clearInterval(id)
  }, [running])
  return running ? 'cyan' : glow ? 'cyan' : 'gray'
}

export function Prompt({ running, connected, onSubmit }: PromptProps): React.ReactElement {
  const [value, setValue] = useState('')
  const borderColor = useBorderGlow(running)

  const handleSubmit = (v: string): void => {
    const trimmed = v.trim()
    if (!trimmed || running) return
    setValue('')
    onSubmit(trimmed)
  }

  const placeholder = connected
    ? 'ask anything  ·  /help for commands'
    : '⚠ not connected — /connect <provider> <key>  (sending will error)'

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={borderColor} paddingX={1}>
      <Box>
        {running ? (
          <>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text dimColor> working… (press Esc to cancel)</Text>
          </>
        ) : (
          <>
            <Text color="green" bold>
              ❯{' '}
            </Text>
            <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} placeholder={placeholder} />
          </>
        )}
      </Box>
    </Box>
  )
}
