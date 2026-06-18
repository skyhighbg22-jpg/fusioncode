import { describe, it, expect } from 'vitest'
import { parseSlashCommand, evalCommand, HELP_TEXT } from './commands.js'

describe('parseSlashCommand', () => {
  it('returns null for non-slash input', () => {
    expect(parseSlashCommand('hello world')).toBeNull()
    expect(parseSlashCommand('')).toBeNull()
  })

  it('parses a command with no args', () => {
    expect(parseSlashCommand('/help')).toEqual({ command: 'help', args: '' })
    expect(parseSlashCommand('/clear')).toEqual({ command: 'clear', args: '' })
  })

  it('parses a command with args', () => {
    expect(parseSlashCommand('/mode build')).toEqual({ command: 'mode', args: 'build' })
    expect(parseSlashCommand('/model gpt-4o-mini')).toEqual({ command: 'model', args: 'gpt-4o-mini' })
  })

  it('trims whitespace and lowercases the command name', () => {
    expect(parseSlashCommand('  /MODE   review  ')).toEqual({ command: 'mode', args: 'review' })
  })

  it('returns "unknown" for unrecognized commands', () => {
    expect(parseSlashCommand('/foobar')).toEqual({ command: 'unknown', args: 'foobar' })
  })
})

describe('evalCommand', () => {
  it('help toggles the overlay', () => {
    expect(evalCommand({ command: 'help', args: '' }).kind).toBe('toggle-help')
  })

  it('mode with a valid mode returns set-mode', () => {
    expect(evalCommand({ command: 'mode', args: 'plan' })).toEqual({ kind: 'set-mode', value: 'plan' })
  })

  it('mode with no args is an error', () => {
    const r = evalCommand({ command: 'mode', args: '' })
    expect(r.kind).toBe('error')
    expect(r.message).toContain('Valid modes')
  })

  it('mode with an invalid mode is an error', () => {
    const r = evalCommand({ command: 'mode', args: 'foo' })
    expect(r.kind).toBe('error')
    expect(r.message).toContain("Unknown mode 'foo'")
  })

  it('model and provider require an argument', () => {
    expect(evalCommand({ command: 'model', args: '' }).kind).toBe('error')
    expect(evalCommand({ command: 'model', args: 'gpt-4o' })).toEqual({ kind: 'set-model', value: 'gpt-4o' })
    expect(evalCommand({ command: 'provider', args: '' }).kind).toBe('error')
    expect(evalCommand({ command: 'provider', args: 'groq' })).toEqual({
      kind: 'set-provider',
      value: 'groq',
    })
  })

  it('clear, status, exit map to their kinds', () => {
    expect(evalCommand({ command: 'clear', args: '' }).kind).toBe('clear')
    expect(evalCommand({ command: 'status', args: '' }).kind).toBe('show-status')
    expect(evalCommand({ command: 'exit', args: '' }).kind).toBe('exit')
  })

  it('unknown command produces a friendly error', () => {
    const r = evalCommand({ command: 'unknown', args: 'foobar' })
    expect(r.kind).toBe('error')
    expect(r.message).toContain('/foobar')
    expect(r.message).toContain('/help')
  })

  it('HELP_TEXT lists all commands', () => {
    expect(HELP_TEXT).toContain('/help')
    expect(HELP_TEXT).toContain('/mode')
    expect(HELP_TEXT).toContain('/exit')
  })
})
