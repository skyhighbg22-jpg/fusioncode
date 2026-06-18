// ============================================================
// FusionCode — Git Integration
// Inspired by: Aider git-native pair programming,
//              auto-commit, diff preview, undo support
// ============================================================

import simpleGit, { type SimpleGit } from 'simple-git'
import type { GitDiff } from '../types/index.js'
import { toErrorMessage } from '../utils/errors.js'

export class GitManager {
  private git: SimpleGit
  private readonly cwd: string

  constructor(cwd = process.cwd()) {
    this.cwd = cwd
    this.git = simpleGit(cwd)
  }

  async isGitRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo()
    } catch {
      return false
    }
  }

  async status(): Promise<string> {
    const s = await this.git.status()
    const lines = [
      `Branch: ${s.current}`,
      `Modified: ${s.modified.join(', ') || 'none'}`,
      `Added: ${s.created.join(', ') || 'none'}`,
      `Deleted: ${s.deleted.join(', ') || 'none'}`,
      `Untracked: ${s.not_added.join(', ') || 'none'}`,
      `Staged: ${s.staged.join(', ') || 'none'}`,
    ]
    return lines.join('\n')
  }

  async diff(staged = false): Promise<GitDiff> {
    const diffStr = staged ? await this.git.diff(['--staged']) : await this.git.diff()

    // Use simple-git's structured status for the file list instead of
    // fragile regex parsing of the diff text.
    const status = await this.git.status()
    const files = staged
      ? [...status.staged]
      : [...status.modified, ...status.not_added, ...status.created, ...status.deleted]

    // Count + / - lines, excluding diff headers (+++/---) and no-newline markers.
    const additions = (diffStr.match(/^\+[^+]/gm) ?? []).length
    const deletions = (diffStr.match(/^-[^-]/gm) ?? []).length

    return { files, additions, deletions, diff: diffStr }
  }

  async stageAll(): Promise<void> {
    await this.git.add('.')
  }

  async stageFiles(files: string[]): Promise<void> {
    await this.git.add(files)
  }

  async commit(message: string, prefix = 'fusioncode:'): Promise<string> {
    const fullMessage = prefix ? `${prefix} ${message}` : message
    const result = await this.git.commit(fullMessage)
    return result.commit
  }

  async autoCommit(message: string, prefix = 'fusioncode:', files?: string[]): Promise<string | null> {
    if (!(await this.hasChanges())) return null

    try {
      if (files && files.length > 0) {
        await this.stageFiles(files)
      } else {
        await this.stageAll()
      }
    } catch (e) {
      throw new Error(`Failed to stage changes: ${toErrorMessage(e)}`)
    }

    if (!(await this.hasStagedChanges())) return null

    try {
      return await this.commit(message, prefix)
    } catch (e) {
      throw new Error(`Failed to commit: ${toErrorMessage(e)}`)
    }
  }

  async hasChanges(): Promise<boolean> {
    const s = await this.git.status()
    return s.files.length > 0
  }

  async hasStagedChanges(): Promise<boolean> {
    const s = await this.git.status()
    return s.staged.length > 0
  }

  async log(n = 10): Promise<Array<{ hash: string; message: string; date: string; author: string }>> {
    const result = await this.git.log({ maxCount: n })
    return result.all.map((c) => ({
      hash: c.hash.slice(0, 7),
      message: c.message,
      date: c.date,
      author: c.author_name,
    }))
  }

  async revert(commitHash: string): Promise<void> {
    await this.git.revert(commitHash, ['--no-commit'])
  }

  async currentBranch(): Promise<string> {
    const s = await this.git.status()
    return s.current ?? 'unknown'
  }

  async branches(): Promise<string[]> {
    const result = await this.git.branch()
    return result.all
  }

  async createBranch(name: string): Promise<void> {
    await this.git.checkoutLocalBranch(name)
  }

  async getLastCommitHash(): Promise<string> {
    const result = await this.git.revparse(['HEAD'])
    return result.trim().slice(0, 7)
  }

  /** Generate a human-readable summary of a diff for commit messages. */
  static summarizeDiff(diff: GitDiff): string {
    if (diff.files.length === 0) return 'no changes'
    const fileList = diff.files.slice(0, 5).join(', ')
    const more = diff.files.length > 5 ? ` (+${diff.files.length - 5} more)` : ''
    return `update ${fileList}${more} (+${diff.additions}/-${diff.deletions})`
  }
}

/**
 * Process-wide singleton keyed by cwd. Prefer RuntimeContext.getGit()
 * for per-run isolation; this helper remains for the CLI path.
 */
let _git: GitManager | null = null
let _gitCwd: string | null = null

export function getGitManager(cwd?: string): GitManager {
  if (!_git || (cwd && cwd !== _gitCwd)) {
    _git = new GitManager(cwd)
    _gitCwd = cwd ?? _gitCwd
  }
  return _git
}
