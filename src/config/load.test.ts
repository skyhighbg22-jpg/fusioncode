import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig } from './index.js'
import { DEFAULT_CONFIG } from './defaults.js'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('loadConfig', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fusion-test-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('returns defaults when no config file exists', () => {
    const config = loadConfig(tmp)
    expect(config.defaultProvider).toBe(DEFAULT_CONFIG.defaultProvider)
    expect(config.providers.openai.model).toBe(DEFAULT_CONFIG.providers.openai.model)
  })

  it('merges local config over defaults', () => {
    writeFileSync(join(tmp, 'fusioncode.json'), JSON.stringify({ defaultProvider: 'groq' }))
    const config = loadConfig(tmp)
    expect(config.defaultProvider).toBe('groq')
    // other defaults preserved
    expect(config.memory.enabled).toBe(true)
  })

  it('applies FUSION_PROVIDER env override', () => {
    const prev = process.env.FUSION_PROVIDER
    process.env.FUSION_PROVIDER = 'deepseek'
    try {
      const config = loadConfig(tmp)
      expect(config.defaultProvider).toBe('deepseek')
    } finally {
      if (prev) process.env.FUSION_PROVIDER = prev
      else delete process.env.FUSION_PROVIDER
    }
  })

  it('applies FUSION_MODEL env override to the default provider', () => {
    const prevModel = process.env.FUSION_MODEL
    process.env.FUSION_MODEL = 'gpt-4o-mini'
    try {
      const config = loadConfig(tmp)
      expect(config.providers.openai.model).toBe('gpt-4o-mini')
    } finally {
      if (prevModel) process.env.FUSION_MODEL = prevModel
      else delete process.env.FUSION_MODEL
    }
  })

  it('applies provider API key env overrides', () => {
    const prev = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'sk-test-123'
    try {
      const config = loadConfig(tmp)
      expect(config.providers.openai.apiKey).toBe('sk-test-123')
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev
      else delete process.env.OPENAI_API_KEY
    }
  })

  it('falls back to defaults on invalid config (does not throw)', () => {
    writeFileSync(join(tmp, 'fusioncode.json'), '{ this is not valid json')
    const config = loadConfig(tmp)
    expect(config.defaultProvider).toBe(DEFAULT_CONFIG.defaultProvider)
  })
})
