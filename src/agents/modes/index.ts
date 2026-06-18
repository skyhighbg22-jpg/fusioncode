// ============================================================
// FusionCode — Agent Mode Registry
// ============================================================

import type { AgentMode } from '../../types/index.js'
import type { ModeStrategy } from './base.js'
import { BuildMode } from './build.js'
import { DebugMode } from './debug.js'
import { PlanMode } from './plan.js'
import { ReviewMode } from './review.js'
import { CheckMode } from './check.js'

export type { ModeStrategy, RunContext } from './base.js'

const MODES: Record<AgentMode, ModeStrategy> = {
  build: new BuildMode(),
  plan: new PlanMode(),
  debug: new DebugMode(),
  review: new ReviewMode(),
  check: new CheckMode(),
}

/** Get a mode strategy by name. Throws on unknown mode (fail loud). */
export function getMode(name: string): ModeStrategy {
  const mode = MODES[name as AgentMode]
  if (!mode) {
    throw new Error(`Unknown agent mode: '${name}'. Available: ${Object.keys(MODES).join(', ')}`)
  }
  return mode
}

export function listAgentModes(): AgentMode[] {
  return Object.keys(MODES) as AgentMode[]
}

export { BuildMode, DebugMode, PlanMode, ReviewMode, CheckMode }
