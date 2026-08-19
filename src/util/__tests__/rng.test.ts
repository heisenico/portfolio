import { describe, expect, it } from 'vitest'
import { mulberry32, randRange, pick } from '../rng'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different streams for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })

  it('stays within [0, 1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 500; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randRange', () => {
  it('stays within bounds', () => {
    const r = mulberry32(9)
    for (let i = 0; i < 200; i++) {
      const v = randRange(r, -3, 5)
      expect(v).toBeGreaterThanOrEqual(-3)
      expect(v).toBeLessThan(5)
    }
  })
})

describe('pick', () => {
  it('returns a member of the source array', () => {
    const r = mulberry32(3)
    const src = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) expect(src).toContain(pick(r, src))
  })
})
