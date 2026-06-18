// ============================================================
// FusionCode — Config System
// Inspired by: OpenClaude provider profiles, OpenCode config,
//              KiloCode .kilo config, MiMo .mimocode
// ============================================================

import fs from 'fs'
import path from 'path'
import os from 'os'
import type { FusionConfig, ProviderConfig } from '../types/index.js'
import { logger } from '../logger/index.js'
import { toErrorMessage } from '../utils/errors.js'
import { CONFIG_FILENAME, DEFAULT_CONFIG, GLOBAL_CONFIG_DIR_SUFFIX } from './defaults.js'
import { FusionConfigSchema } from './schema.js'

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), GLOBAL_CONFIG_DIR_SUFFIX)
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, CONFIG_FILENAME)

const ENV_PROVIDER_MAP: Record<string, string> = {
  OPENAI_API_KEY: 'openai',
  DEEPSEEK_API_KEY: 'deepseek',
  GROQ_API_KEY: 'groq',
  MISTRAL_API_KEY: 'mistral',
  OPENROUTER_API_KEY: 'openrouter',
  TOGETHER_API_KEY: 'together',
  COHERE_API_KEY: 'cohere',
}

/**
 * Load config with precedence: DEFAULT_CONFIG < global < local, then
 * environment-variable overrides. Validated against the zod schema so a
 * malformed user config fails loudly instead of producing a broken shape.
 *
 * Not cached: each call re-reads from disk. Config reads are tiny and
 * infrequent, and avoiding the cache removes an entire class of
 * shared-mutable-state bugs.
 */
export function loadConfig(projectRoot?: string): FusionConfig {
  const root = projectRoot ?? process.cwd()

  const localConfig = readJsonConfig([
    path.join(root, CONFIG_FILENAME),
    path.join(root, '.fusion', CONFIG_FILENAME),
  ])
  const globalConfig = readJsonConfig([GLOBAL_CONFIG_PATH])

  const merged = deepMerge(DEFAULT_CONFIG, deepMerge(globalConfig, localConfig))

  // Validate the final shape; surface a clear error on bad config.
  const parsed = FusionConfigSchema.safeParse(merged)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    logger.warn(`Invalid fusioncode.json — falling back to defaults. Issues:\n${issues}`)
    return applyEnvOverrides(structuredClone(DEFAULT_CONFIG))
  }

  return applyEnvOverrides(parsed.data)
}

function readJsonConfig(paths: string[]): Partial<FusionConfig> {
  for (const p of paths) {
    if (!fs.existsSync(p)) continue
    try {
      const raw = fs.readFileSync(p, 'utf-8')
      return JSON.parse(raw) as Partial<FusionConfig>
    } catch (e) {
      // Don't silently swallow: warn so the user knows their config is unreadable.
      logger.warn(`Could not parse config at ${p}: ${toErrorMessage(e)}`)
    }
  }
  return {}
}

function applyEnvOverrides(config: FusionConfig): FusionConfig {
  for (const [envVar, providerName] of Object.entries(ENV_PROVIDER_MAP)) {
    const key = process.env[envVar]
    const provider = config.providers[providerName]
    if (key && provider) provider.apiKey = key
  }

  const envProvider = process.env.FUSION_PROVIDER
  const envModel = process.env.FUSION_MODEL
  if (envProvider) config.defaultProvider = envProvider
  if (envModel && config.providers[config.defaultProvider]) {
    config.providers[config.defaultProvider].model = envModel
  }

  return config
}

export function saveConfig(config: FusionConfig, global = false): void {
  const p = global ? GLOBAL_CONFIG_PATH : path.join(process.cwd(), CONFIG_FILENAME)
  if (global) {
    try {
      fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true })
    } catch (e) {
      throw new Error(`Could not create global config dir ${GLOBAL_CONFIG_DIR}: ${toErrorMessage(e)}`)
    }
  }
  fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8')
}

export function getProviderConfig(name: string, projectRoot?: string): ProviderConfig {
  const config = loadConfig(projectRoot)
  const provider = config.providers[name]
  if (!provider) {
    throw new Error(`Provider '${name}' not found. Available: ${Object.keys(config.providers).join(', ')}`)
  }
  return provider
}

export function listProviderNames(projectRoot?: string): string[] {
  return Object.keys(loadConfig(projectRoot).providers)
}

/**
 * Deep-merge two plain objects. Arrays are replaced wholesale (not
 * index-merged) — a user's `checks: []` should clear defaults, not append.
 */
export function deepMerge<T>(target: unknown, source: unknown): T {
  if (Array.isArray(target) || Array.isArray(source)) {
    return (source === undefined ? target : source) as T
  }
  if (typeof target !== 'object' || target === null) return (source ?? target) as T
  if (typeof source !== 'object' || source === null) return target as T

  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
    result[k] = deepMerge((target as Record<string, unknown>)[k], v)
  }
  return result as T
}
