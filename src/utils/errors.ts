// ============================================================
// FusionCode — Error Utilities
// ============================================================

/** Safely extract a human-readable message from any thrown value. */
export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message
    return typeof msg === 'string' ? msg : String(msg)
  }
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

/** True if the thrown value is an AbortError / signal abort. */
export function isAbortError(e: unknown): boolean {
  if (e instanceof Error) {
    return e.name === 'AbortError' || /aborted/i.test(e.message)
  }
  return false
}
