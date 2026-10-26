import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe } from 'vitest'

/**
 * describe() that runs only when every listed fixture file is present.
 * Plain describe.skip is not enough: vitest still executes the suite body
 * during collection, and the bodies read fixture files at that point.
 */
export function withFixtures(...files: string[]): (name: string, fn: () => void) => void {
  const missing = files.filter(
    (f) => !existsSync(fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url))),
  )
  if (missing.length === 0) return describe
  return (name) => describe.skip(`${name} (missing fixtures: ${missing.join(', ')})`, () => {})
}
