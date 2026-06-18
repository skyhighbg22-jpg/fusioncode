// ============================================================
// FusionCode — Config Defaults
// ============================================================

import type { FusionConfig } from '../types/index.js'

export const CONFIG_FILENAME = 'fusioncode.json'
export const GLOBAL_CONFIG_DIR_SUFFIX = '.fusioncode'

export const DEFAULT_CONFIG: FusionConfig = {
  defaultAgent: 'build',
  defaultProvider: 'openai',
  providers: {
    openai: {
      name: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY ?? '',
      model: 'gpt-4o',
    },
    deepseek: {
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      model: 'deepseek-chat',
    },
    groq: {
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY ?? '',
      model: 'llama-3.3-70b-versatile',
    },
    mistral: {
      name: 'mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      apiKey: process.env.MISTRAL_API_KEY ?? '',
      model: 'mistral-large-latest',
    },
    openrouter: {
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      model: 'anthropic/claude-3.7-sonnet',
    },
    together: {
      name: 'together',
      baseUrl: 'https://api.together.xyz/v1',
      apiKey: process.env.TOGETHER_API_KEY ?? '',
      model: 'meta-llama/Llama-3-70b-chat-hf',
    },
    ollama: {
      name: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'ollama',
      model: 'llama3.2',
    },
    lmstudio: {
      name: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      apiKey: 'lm-studio',
      model: 'local-model',
    },
    cohere: {
      name: 'cohere',
      baseUrl: 'https://api.cohere.ai/compatibility/v1',
      apiKey: process.env.COHERE_API_KEY ?? '',
      model: 'command-r-plus',
    },
    custom: {
      name: 'custom',
      baseUrl: 'http://localhost:8080/v1',
      apiKey: '',
      model: 'custom',
    },
  },
  memory: {
    enabled: true,
    dir: '.fusion/memory',
    maxTokensBudget: 2000,
    autoCheckpoint: true,
    checkpointInterval: 10,
  },
  git: {
    autoCommit: false,
    commitMessagePrefix: 'fusioncode:',
    showDiff: true,
    requireClean: false,
  },
  server: {
    enabled: false,
    port: 7891,
    host: '127.0.0.1',
  },
  checks: [],
}
