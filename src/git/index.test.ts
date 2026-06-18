import { describe, it, expect } from 'vitest'
import { GitManager } from './index.js'
import type { GitDiff } from '../types/index.js'

describe('GitManager.summarizeDiff', () => {
  it('returns "no changes" for an empty diff', () => {
    const diff: GitDiff = { files: [], additions: 0, deletions: 0, diff: '' }
    expect(GitManager.summarizeDiff(diff)).toBe('no changes')
  })

  it('lists up to 5 files with a +more suffix', () => {
    const diff: GitDiff = {
      files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts'],
      additions: 30,
      deletions: 5,
      diff: '',
    }
    const summary = GitManager.summarizeDiff(diff)
    expect(summary).toContain('a.ts, b.ts, c.ts, d.ts, e.ts')
    expect(summary).toContain('+2 more')
    expect(summary).toContain('+30/-5')
  })

  it('omits the more suffix when <= 5 files', () => {
    const diff: GitDiff = { files: ['a.ts', 'b.ts'], additions: 1, deletions: 1, diff: '' }
    expect(GitManager.summarizeDiff(diff)).not.toContain('more')
  })
})
