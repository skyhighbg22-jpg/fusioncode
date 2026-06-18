import React from 'react'
import { Text, Box } from 'ink'

// ANSI Shadow font — "FUSION" (generated via figlet, spells correctly).
const LOGO = [
  '███████╗██╗   ██╗███████╗██╗ ██████╗ ███╗   ██╗',
  '██╔════╝██║   ██║██╔════╝██║██╔═══██╗████╗  ██║',
  '█████╗  ██║   ██║███████╗██║██║   ██║██╔██╗ ██║',
  '██╔══╝  ██║   ██║╚════██║██║██║   ██║██║╚██╗██║',
  '██║     ╚██████╔╝███████║██║╚██████╔╝██║ ╚████║',
  '╚═╝      ╚═════╝ ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝',
]

export function Banner({ version }: { version: string }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {LOGO.map((line, i) => (
        <Text key={i} color="cyan">
          {line}
        </Text>
      ))}
      <Text dimColor>The peak AI coding agent CLI · v{version}</Text>
      <Text dimColor>Type a prompt to begin · /help for commands · /exit to quit</Text>
    </Box>
  )
}
