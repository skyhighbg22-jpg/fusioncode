import { describe, it, expect } from 'vitest'
import { getMode, listAgentModes } from './index.js'

describe('modes registry', () => {
  it('lists all 5 modes', () => {
    expect(listAgentModes().sort()).toEqual(['build', 'check', 'debug', 'plan', 'review'])
  })

  it('returns each mode with the right readonly flag', () => {
    expect(getMode('build').readonly).toBe(false)
    expect(getMode('debug').readonly).toBe(false)
    expect(getMode('check').readonly).toBe(false)
    expect(getMode('plan').readonly).toBe(true)
    expect(getMode('review').readonly).toBe(true)
  })

  it('each mode produces a non-empty system prompt', () => {
    for (const name of listAgentModes()) {
      const prompt = getMode(name).systemPrompt()
      expect(prompt.length).toBeGreaterThan(0)
      expect(prompt).toContain('FusionCode')
    }
  })

  it('throws on an unknown mode', () => {
    expect(() => getMode('nonexistent')).toThrow(/Unknown agent mode/)
  })

  it('respects per-mode iteration caps', () => {
    expect(getMode('build').maxIterations).toBe(50)
    expect(getMode('plan').maxIterations).toBe(30)
    expect(getMode('review').maxIterations).toBe(30)
    expect(getMode('debug').maxIterations).toBe(50)
    expect(getMode('check').maxIterations).toBe(20)
  })
})
