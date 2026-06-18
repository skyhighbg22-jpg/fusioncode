// ============================================================
// FusionCode — Config Schema (zod)
// Runtime validation for user-provided fusioncode.json so a
// malformed config produces a clear error instead of a broken
// runtime shape that fails silently downstream.
// ============================================================

import { z } from 'zod'

export const AgentModeSchema = z.enum(['build', 'plan', 'debug', 'review', 'check'])

export const ProviderConfigSchema = z.object({
  name: z.string(),
  baseUrl: z.string(),
  apiKey: z.string().optional(),
  model: z.string(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

export const MemoryConfigSchema = z.object({
  enabled: z.boolean(),
  dir: z.string(),
  maxTokensBudget: z.number().int().positive(),
  autoCheckpoint: z.boolean(),
  checkpointInterval: z.number().int().positive(),
})

export const GitConfigSchema = z.object({
  autoCommit: z.boolean(),
  commitMessagePrefix: z.string(),
  showDiff: z.boolean(),
  requireClean: z.boolean(),
})

export const ServerConfigSchema = z.object({
  enabled: z.boolean(),
  port: z.number().int().min(0).max(65535),
  host: z.string(),
  auth: z.string().optional(),
})

export const CheckConfigSchema = z.object({
  name: z.string(),
  file: z.string(),
  agent: AgentModeSchema,
  provider: z.string().optional(),
  auto: z.boolean(),
})

export const FusionConfigSchema = z.object({
  defaultAgent: AgentModeSchema,
  defaultProvider: z.string(),
  providers: z.record(z.string(), ProviderConfigSchema),
  memory: MemoryConfigSchema,
  git: GitConfigSchema,
  server: ServerConfigSchema,
  checks: z.array(CheckConfigSchema),
})
