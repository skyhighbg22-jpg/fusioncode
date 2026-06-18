import React from 'react'
import { Text, Box } from 'ink'

export function UserTurn({ content }: { content: string }): React.ReactElement {
  return (
    <Box marginBottom={0}>
      <Text color="blue" bold>
        ❯{' '}
      </Text>
      <Text>{content}</Text>
    </Box>
  )
}
