import React, { useState, useEffect } from 'react'
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

const LOGO_WIDTH = Math.max(...LOGO.map((l) => l.length))
const HIGHLIGHT_WIDTH = 8 // columns in the moving reflection band

interface BannerProps {
  version: string
}

/** A single logo line with the moving reflection band. Indices are clamped so
 *  an off-screen band renders nothing (no duplication) — only the visible
 *  portion of the band is highlighted. */
function LogoLine({ line, highlightStart }: { line: string; highlightStart: number }): React.ReactElement {
  const start = Math.max(0, highlightStart)
  const end = Math.min(line.length, highlightStart + HIGHLIGHT_WIDTH)
  // Band entirely off-screen (before the left edge or past the right edge):
  // render the whole line in steady cyan, no highlight.
  if (end <= start) {
    return <Text color="cyan">{line}</Text>
  }
  const before = line.slice(0, start)
  const mid = line.slice(start, end)
  const after = line.slice(end)
  return (
    <Box>
      <Text color="cyan">{before}</Text>
      <Text color="whiteBright" bold>{mid}</Text>
      <Text color="cyan">{after}</Text>
    </Box>
  )
}

export function Banner({ version }: BannerProps): React.ReactElement {
  // Build-in: reveal lines one-by-one (80ms stagger).
  const [visibleLines, setVisibleLines] = useState(1)
  useEffect(() => {
    if (visibleLines >= LOGO.length) return
    const id = setTimeout(() => setVisibleLines((n) => n + 1), 80)
    return () => clearTimeout(id)
  }, [visibleLines])

  // Light-sweep: a reflection band glides left→right. It grows in from the
  // left edge, travels across, and fully exits the right edge before wrapping
  // — so the motion is continuous with no visible "snap" back to the start.
  // start goes 0 → LOGO_WIDTH; the visible band is [start, start+HIGHLIGHT_WIDTH)
  // clamped to the line length inside LogoLine.
  const [highlight, setHighlight] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      // Wrap only once the band has cleared the right edge entirely.
      setHighlight((h) => (h > LOGO_WIDTH ? 0 : h + 1))
    }, 60)
    return () => clearInterval(id)
  }, [])

  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      {LOGO.slice(0, visibleLines).map((line, i) => (
        <LogoLine key={i} line={line} highlightStart={highlight} />
      ))}
      <Text dimColor>The peak AI coding agent CLI · v{version}</Text>
      <Text dimColor>Type a prompt to begin · /help for commands · Tab to cycle modes · /exit to quit</Text>
    </Box>
  )
}
