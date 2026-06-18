import { describe, it, expect } from 'vitest'
import { deepMerge } from './index.js'
import { DEFAULT_CONFIG } from './defaults.js'

describe('deepMerge', () => {
  it('merges nested objects', () => {
    const merged = deepMerge({ a: { b: 1, c: 2 } }, { a: { c: 3 } })
    expect(merged).toEqual({ a: { b: 1, c: 3 } })
  })

  it('replaces arrays wholesale (not index-merged)', () => {
    const merged = deepMerge({ checks: [1, 2, 3] }, { checks: [9] })
    expect(merged).toEqual({ checks: [9] })
  })

  it('replaces arrays with an empty array (clears defaults)', () => {
    const merged = deepMerge({ checks: [{ name: 'a' }] }, { checks: [] })
    expect(merged).toEqual({ checks: [] })
  })

  it('source undefined keeps target', () => {
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 })
  })

  it('target null returns source', () => {
    expect(deepMerge(null, { a: 1 })).toEqual({ a: 1 })
  })
})

describe('DEFAULT_CONFIG', () => {
  it('does not include anthropic provider (dropped)', () => {
    expect(DEFAULT_CONFIG.providers).not.toHaveProperty('anthropic')
  })

  it('registers the 10 OpenAI-compatible providers', () => {
    const expected = [
      'openai',
      'deepseek',
      'groq',
      'mistral',
      'openrouter',
      'together',
      'ollama',
      'lmstudio',
      'cohere',
      'custom',
    ]
    for (const name of expected) {
      expect(DEFAULT_CONFIG.providers).toHaveProperty(name)
    }
  })

  it('has sensible defaults', () => {
    expect(DEFAULT_CONFIG.defaultAgent).toBe('build')
    expect(DEFAULT_CONFIG.defaultProvider).toBe('openai')
    expect(DEFAULT_CONFIG.memory.enabled).toBe(true)
  })
})
