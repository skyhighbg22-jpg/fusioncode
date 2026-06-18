import React from 'react'
import { Text, Box } from 'ink'

interface UserTurnProps {
  content: string
  username?: string
}

export function UserTurn({ content, username }: UserTurnProps): React.ReactElement {
  return (
    <Box marginBottom={0}>
      <Text color="blue" bold>
        {username ? `${username}` : 'you'}
      </Text>
      <Text dimColor> › </Text>
      <Text>{content}</Text>
    </Box>
  )
}
