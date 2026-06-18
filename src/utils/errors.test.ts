import { describe, it, expect } from 'vitest'
import { toErrorMessage, isAbortError } from './errors.js'

describe('toErrorMessage', () => {
  it('extracts message from Error', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns strings as-is', () => {
    expect(toErrorMessage('plain string')).toBe('plain string')
  })

  it('extracts .message from object', () => {
    expect(toErrorMessage({ message: 'obj msg' })).toBe('obj msg')
  })

  it('stringifies other values', () => {
    expect(toErrorMessage(42)).toBe('42')
    expect(toErrorMessage(null)).toBe('null')
  })
})

describe('isAbortError', () => {
  it('detects AbortError by name', () => {
    const e = new Error('aborted')
    e.name = 'AbortError'
    expect(isAbortError(e)).toBe(true)
  })

  it('detects abort by message', () => {
    expect(isAbortError(new Error('The operation was aborted'))).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isAbortError(new Error('nope'))).toBe(false)
  })
})
