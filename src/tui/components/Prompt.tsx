import React, { useState } from 'react'
import { Text, Box } from 'ink'
import TextInput from 'ink-text-input'

interface PromptProps {
  running: boolean
  onSubmit: (value: string) => void
}

export function Prompt({ running, onSubmit }: PromptProps): React.ReactElement {
  const [value, setValue] = useState('')

  const handleSubmit = (v: string): void => {
    const trimmed = v.trim()
    if (!trimmed || running) return
    setValue('')
    onSubmit(trimmed)
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="green" bold>
          ❯{' '}
        </Text>
        {running ? (
          <Text dimColor>working… (press Esc to cancel)</Text>
        ) : (
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="ask anything  ·  /help for commands"
          />
        )}
      </Box>
    </Box>
  )
}
