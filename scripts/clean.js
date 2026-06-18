#!/usr/bin/env node
// Cross-platform clean: removes dist/ and coverage/ without relying on rm -rf.
import { rmSync } from 'fs'

const targets = ['dist', 'coverage']
for (const t of targets) {
  try {
    rmSync(t, { recursive: true, force: true })
    console.log(`removed ${t}`)
  } catch (e) {
    console.error(`could not remove ${t}: ${e.message}`)
  }
}
