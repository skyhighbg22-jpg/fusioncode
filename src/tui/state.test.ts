import { describe, it, expect } from 'vitest'
import { createInitialState, reducer } from './state.js'

function init() {
  return createInitialState({ mode: 'build', provider: 'openai', model: 'gpt-4o' })
}

describe('TUI reducer', () => {
  it('starts idle with a banner and no turns', () => {
    const s = init()
    expect(s.status).toBe('idle')
    expect(s.showBanner).toBe(true)
    expect(s.turns).toHaveLength(0)
  })

  it('submit seeds a user turn + an in-flight assistant turn and sets running', () => {
    const s = reducer(init(), { type: 'submit', prompt: 'hello' })
    expect(s.status).toBe('running')
    expect(s.showBanner).toBe(false)
    expect(s.turns).toHaveLength(2)
    expect(s.turns[0]).toMatchObject({ role: 'user', content: 'hello' })
    expect(s.turns[1]).toMatchObject({ role: 'assistant', streaming: true })
    expect(s.streamingText).toBe('')
  })

  it('accumulates streaming text tokens', () => {
    let s = reducer(init(), { type: 'submit', prompt: 'hi' })
    s = reducer(s, { type: 'text', content: 'Hello' })
    s = reducer(s, { type: 'text', content: ' world' })
    expect(s.streamingText).toBe('Hello world')
  })

  it('appends tool_call events and attaches tool_result to the matching call', () => {
    let s = reducer(init(), { type: 'submit', prompt: 'list dir' })
    s = reducer(s, { type: 'tool_call', name: 'list_dir', args: '{"path":"."}' })
    s = reducer(s, { type: 'tool_result', name: 'list_dir', result: 'a.ts\nb.ts' })
    expect(s.currentTools).toHaveLength(1)
    expect(s.currentTools[0]).toMatchObject({ kind: 'call', name: 'list_dir', result: 'a.ts\nb.ts' })
  })

  it('done finalizes the assistant turn with the accumulated text and returns to idle', () => {
    let s = reducer(init(), { type: 'submit', prompt: 'hi' })
    s = reducer(s, { type: 'text', content: 'final answer' })
    s = reducer(s, { type: 'done' })
    expect(s.status).toBe('idle')
    expect(s.streamingText).toBe('')
    expect(s.currentTools).toHaveLength(0)
    const last = s.turns[s.turns.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.streaming).toBe(false)
    expect(last.content).toBe('final answer')
  })

  it('cancelled marks the turn with [cancelled] and sets status', () => {
    let s = reducer(init(), { type: 'submit', prompt: 'hi' })
    s = reducer(s, { type: 'text', content: 'partial' })
    s = reducer(s, { type: 'cancelled' })
    expect(s.status).toBe('cancelled')
    const last = s.turns[s.turns.length - 1]
    expect(last.streaming).toBe(false)
    expect(last.content).toContain('partial')
    expect(last.content).toContain('[cancelled]')
  })

  it('error records the message and finalizes the turn', () => {
    let s = reducer(init(), { type: 'submit', prompt: 'hi' })
    s = reducer(s, { type: 'error', message: 'boom' })
    expect(s.status).toBe('error')
    expect(s.error).toBe('boom')
    expect(s.turns[s.turns.length - 1].content).toContain('[error: boom]')
  })

  it('set_mode / set_provider / set_model update the active config', () => {
    let s = init()
    s = reducer(s, { type: 'set_mode', mode: 'review' })
    s = reducer(s, { type: 'set_provider', provider: 'groq' })
    s = reducer(s, { type: 'set_model', model: 'llama-3.3-70b-versatile' })
    expect(s.mode).toBe('review')
    expect(s.provider).toBe('groq')
    expect(s.model).toBe('llama-3.3-70b-versatile')
  })

  it('clear empties turns and resets to idle', () => {
    let s = reducer(init(), { type: 'submit', prompt: 'hi' })
    s = reducer(s, { type: 'clear' })
    expect(s.turns).toHaveLength(0)
    expect(s.status).toBe('idle')
    expect(s.showBanner).toBe(false)
  })

  it('toggle_help flips the help flag', () => {
    let s = init()
    expect(s.showHelp).toBe(false)
    s = reducer(s, { type: 'toggle_help' })
    expect(s.showHelp).toBe(true)
    s = reducer(s, { type: 'toggle_help' })
    expect(s.showHelp).toBe(false)
  })

  it('git updates the git state', () => {
    const s = reducer(init(), { type: 'git', git: { branch: 'main', dirty: 3 } })
    expect(s.git).toEqual({ branch: 'main', dirty: 3 })
  })

  it('multiple turns stack independently', () => {
    let s = init()
    s = reducer(s, { type: 'submit', prompt: 'one' })
    s = reducer(s, { type: 'done', content: 'answer one' })
    s = reducer(s, { type: 'submit', prompt: 'two' })
    s = reducer(s, { type: 'done', content: 'answer two' })
    expect(s.turns).toHaveLength(4) // user, assistant, user, assistant
    expect(s.turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
  })

  it('set_theme updates the theme', () => {
    let s = init()
    s = reducer(s, { type: 'set_theme', theme: 'ocean' })
    expect(s.theme).toBe('ocean')
  })

  it('cycle_theme advances through the theme list and wraps', () => {
    let s = init() // default
    expect(s.theme).toBe('default')
    s = reducer(s, { type: 'cycle_theme' })
    expect(s.theme).toBe('ocean')
    s = reducer(s, { type: 'cycle_theme' })
    s = reducer(s, { type: 'cycle_theme' })
    s = reducer(s, { type: 'cycle_theme' })
    expect(s.theme).toBe('default') // wrapped after forest
  })

  it('set_mode increments modeFlash (triggers pill flash)', () => {
    const s = init()
    const before = s.modeFlash
    const after = reducer(s, { type: 'set_mode', mode: 'plan' })
    expect(after.mode).toBe('plan')
    expect(after.modeFlash).toBe(before + 1)
  })

  it('flash_mode increments the counter without changing mode', () => {
    const s = init()
    expect(reducer(s, { type: 'flash_mode' }).modeFlash).toBe(s.modeFlash + 1)
  })

  it('set_info stores and clears a transient message', () => {
    let s = init()
    s = reducer(s, { type: 'set_info', info: 'hello' })
    expect(s.info).toBe('hello')
    s = reducer(s, { type: 'set_info', info: null })
    expect(s.info).toBeNull()
  })

  it('submit clears any pending info message', () => {
    let s = reducer(init(), { type: 'set_info', info: 'note' })
    s = reducer(s, { type: 'submit', prompt: 'go' })
    expect(s.info).toBeNull()
  })

  it('set_connected updates the connected flag', () => {
    const s = init()
    expect(s.connected).toBe(false)
    expect(reducer(s, { type: 'set_connected', connected: true }).connected).toBe(true)
  })

  it('createInitialState accepts a connected flag', () => {
    const s = createInitialState({ mode: 'build', provider: 'openai', model: 'gpt-4o', connected: true })
    expect(s.connected).toBe(true)
    expect(s.theme).toBe('default')
    expect(s.modeFlash).toBe(0)
    expect(s.info).toBeNull()
  })
})
