// ============================================================
// FusionCode — Logger
// A tiny leveled logger. All output goes to stderr so that
// stdout stays clean for machine-readable results.
// ============================================================

import chalk from 'chalk'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

function envLevel(): LogLevel {
  const raw = process.env.FUSION_LOG_LEVEL
  if (raw && raw in LEVEL_ORDER) return raw as LogLevel
  return 'info'
}

let currentLevel: LogLevel = envLevel()

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

export function getLogLevel(): LogLevel {
  return currentLevel
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel]
}

export interface Logger {
  debug(msg: string, ...args: unknown[]): void
  info(msg: string, ...args: unknown[]): void
  warn(msg: string, ...args: unknown[]): void
  error(msg: string, ...args: unknown[]): void
}

function emit(
  level: LogLevel,
  prefix: string,
  color: (s: string) => string,
  msg: string,
  args: unknown[],
): void {
  if (!shouldLog(level)) return
  const formatted =
    args.length > 0
      ? `${msg} ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`
      : msg
  console.error(color(prefix) + ' ' + formatted)
}

export const logger: Logger = {
  debug: (msg, ...args) => emit('debug', '[debug]', chalk.dim, msg, args),
  info: (msg, ...args) => emit('info', '[info]', chalk.cyan, msg, args),
  warn: (msg, ...args) => emit('warn', '[warn]', chalk.yellow, msg, args),
  error: (msg, ...args) => emit('error', '[error]', chalk.red, msg, args),
}
