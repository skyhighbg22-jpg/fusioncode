import { describe, it, expect } from 'vitest'
import { OpenAICompatibleProvider } from './openai-compatible.js'

describe('OpenAICompatibleProvider', () => {
  it('constructs with a local provider without an API key', () => {
    expect(
      () =>
        new OpenAICompatibleProvider({
          name: 'ollama',
          baseUrl: 'http://localhost:11434/v1',
          apiKey: 'ollama',
          model: 'llama3.2',
        }),
    ).not.toThrow()
  })

  it('throws a clear error for a remote provider missing a key', () => {
    expect(
      () =>
        new OpenAICompatibleProvider({
          name: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4o',
        }),
    ).toThrow(/No API key for provider 'openai'/)
  })
})
