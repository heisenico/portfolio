import { describe, expect, it } from 'vitest'
import {
  Timeline,
  clamp,
  clamp01,
  damp,
  easeInOutCubic,
  easeInQuad,
  easeOutBack,
  easeOutCubic,
  easeOutElastic,
  invLerp,
  lerp,
} from '../tween'

const easings = { easeOutCubic, easeInOutCubic, easeInQuad, easeOutBack, easeOutElastic }

describe('easings', () => {
  it('all pin both endpoints', () => {
    for (const [name, fn] of Object.entries(easings)) {
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 5)
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 5)
    }
  })

  it('easeOutCubic is monotonic', () => {
    let prev = -Infinity
    for (let i = 0; i <= 100; i++) {
      const v = easeOutCubic(i / 100)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('easeOutBack overshoots past 1 before settling', () => {
    const peak = Math.max(...Array.from({ length: 100 }, (_, i) => easeOutBack(i / 100)))
    expect(peak).toBeGreaterThan(1)
  })
})

describe('damp', () => {
  it('converges toward the target', () => {
    let v = 0
    for (let i = 0; i < 200; i++) v = damp(v, 10, 6, 1 / 60)
    expect(v).toBeCloseTo(10, 2)
  })

  it('is a no-op at dt = 0', () => {
    expect(damp(3, 10, 6, 0)).toBe(3)
  })

  it('is frame-rate independent within tolerance', () => {
    let fast = 0
    for (let i = 0; i < 120; i++) fast = damp(fast, 1, 5, 1 / 120)
    let slow = 0
    for (let i = 0; i < 30; i++) slow = damp(slow, 1, 5, 1 / 30)
    expect(fast).toBeCloseTo(slow, 3)
  })
})

describe('helpers', () => {
  it('clamp and clamp01 bound their input', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-5, 0, 3)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(-2)).toBe(0)
  })

  it('lerp and invLerp round-trip', () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5)
    expect(invLerp(10, 20, 12.5)).toBe(0.25)
  })

  it('invLerp does not divide by zero on a degenerate range', () => {
    expect(Number.isFinite(invLerp(5, 5, 5))).toBe(true)
  })
})

describe('Timeline', () => {
  it('fires cues once, in order, when elapsed passes them', () => {
    const fired: string[] = []
    const t = new Timeline()
      .at(0.5, () => fired.push('a'))
      .at(1.5, () => fired.push('b'))

    t.update(0.2)
    expect(fired).toEqual([])
    t.update(0.6)
    expect(fired).toEqual(['a'])
    t.update(0.6)
    expect(fired).toEqual(['a'])
    t.update(2.0)
    expect(fired).toEqual(['a', 'b'])
  })

  it('skipToEnd fires every outstanding cue and marks itself done', () => {
    const fired: string[] = []
    const t = new Timeline().at(1, () => fired.push('a')).at(9, () => fired.push('b'))
    t.skipToEnd()
    expect(fired).toEqual(['a', 'b'])
    expect(t.done).toBe(true)
  })

  it('reports done only after the last cue', () => {
    const t = new Timeline().at(1, () => {})
    expect(t.done).toBe(false)
    t.update(2)
    expect(t.done).toBe(true)
  })
})
