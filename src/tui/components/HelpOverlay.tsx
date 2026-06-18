import React from 'react'
import { Text, Box } from 'ink'
import { HELP_TEXT } from '../commands.js'

export function HelpOverlay(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      {HELP_TEXT.split('\n').map((line, i) => (
        <Text key={i} dimColor={line.trim().length === 0 || !line.startsWith('  /')}>
          {line}
        </Text>
      ))}
    </Box>
  )
}
