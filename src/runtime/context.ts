// ============================================================
// FusionCode — Runtime Context
// Per-run container for config and lazily-created git/memory
// stores. Replaces the module-level mutable singletons
// (_config / _git / _store) that caused stale-cache and
// cross-agent mutation bugs, and makes the agent testable
// (each run gets its own isolated context).
// ============================================================

import type { FusionConfig, ProviderConfig } from '../types/index.js'
import { loadConfig } from '../config/index.js'
import { GitManager } from '../git/index.js'
import { MemoryStore } from '../memory/index.js'

export interface RuntimeContextOptions {
  config?: FusionConfig
  cwd?: string
}

export class RuntimeContext {
  readonly config: FusionConfig
  readonly cwd: string
  private git?: GitManager
  private memory?: MemoryStore

  constructor(options: RuntimeContextOptions = {}) {
    this.config = options.config ?? loadConfig(options.cwd)
    this.cwd = options.cwd ?? process.cwd()
  }

  getGit(): GitManager {
    if (!this.git) this.git = new GitManager(this.cwd)
    return this.git
  }

  getMemory(): MemoryStore {
    if (!this.memory) this.memory = new MemoryStore(this.cwd, this.config.memory.dir)
    return this.memory
  }

  getProviderConfig(name: string): ProviderConfig {
    const provider = this.config.providers[name]
    if (!provider) {
      throw new Error(
        `Provider '${name}' not found. Available: ${Object.keys(this.config.providers).join(', ')}`,
      )
    }
    return provider
  }

  /** Fork a sibling context (e.g. for swarm agents) sharing the same config. */
  fork(cwd?: string): RuntimeContext {
    return new RuntimeContext({ config: this.config, cwd: cwd ?? this.cwd })
  }
}
