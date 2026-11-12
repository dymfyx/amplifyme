import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const guide = join(process.cwd(), 'docs', 'beginner-guide.pdf')
const served = join(process.cwd(), 'public', 'beginner-guide.pdf')

function assertPdf(path: string) {
  expect(existsSync(path)).toBe(true)
  const buffer = readFileSync(path)
  expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  expect(statSync(path).size).toBeGreaterThan(120_000)
  const pages = (buffer.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length
  expect(pages).toBeGreaterThanOrEqual(6)
}

describe('beginner guide', () => {
  it('ships a readable PDF with real content', () => {
    assertPdf(guide)
  })

  it('serves the same guide next to the app', () => {
    assertPdf(served)
    expect(statSync(served).size).toBe(statSync(guide).size)
  })
})
