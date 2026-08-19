import { describe, expect, it } from 'vitest'
import { CURL_EPS, curl3, simplex3 } from '../noise'
import { Vector3 } from 'three'

describe('simplex3', () => {
  it('stays roughly within [-1, 1]', () => {
    for (let i = 0; i < 2000; i++) {
      const v = simplex3(i * 0.31, i * 0.17, i * 0.09)
      expect(v).toBeGreaterThanOrEqual(-1.2)
      expect(v).toBeLessThanOrEqual(1.2)
    }
  })

  it('is deterministic', () => {
    expect(simplex3(1.5, 2.5, 3.5)).toBe(simplex3(1.5, 2.5, 3.5))
  })

  it('is continuous — nearby inputs give nearby outputs', () => {
    const a = simplex3(1, 2, 3)
    const b = simplex3(1.001, 2, 3)
    expect(Math.abs(a - b)).toBeLessThan(0.05)
  })

  it('actually varies across the domain', () => {
    const samples = Array.from({ length: 50 }, (_, i) => simplex3(i * 0.7, 0, 0))
    expect(new Set(samples.map((s) => s.toFixed(4))).size).toBeGreaterThan(10)
  })
})

describe('curl3', () => {
  it('writes a finite vector into the output', () => {
    const out = new Vector3()
    curl3(0.3, 1.7, 2.2, out)
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.y)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
    expect(out.length()).toBeGreaterThan(0)
  })

  it('is divergence-free at its own finite-difference step', () => {
    // Central-difference operators on different axes commute exactly, so the
    // discrete curl has exactly zero discrete divergence when measured at the
    // same step it was built with. This is the property that keeps advected
    // particles from piling up or thinning out. Measuring at a different step
    // does not cancel and says nothing useful about the field.
    const h = CURL_EPS
    const a = new Vector3()
    const b = new Vector3()
    let worst = 0
    for (let i = 0; i < 20; i++) {
      const p = new Vector3(i * 0.4, i * 0.23, i * 0.61)
      curl3(p.x + h, p.y, p.z, a)
      curl3(p.x - h, p.y, p.z, b)
      const dx = (a.x - b.x) / (2 * h)
      curl3(p.x, p.y + h, p.z, a)
      curl3(p.x, p.y - h, p.z, b)
      const dy = (a.y - b.y) / (2 * h)
      curl3(p.x, p.y, p.z + h, a)
      curl3(p.x, p.y, p.z - h, b)
      const dz = (a.z - b.z) / (2 * h)
      worst = Math.max(worst, Math.abs(dx + dy + dz))
    }
    expect(worst).toBeLessThan(1e-6)
  })

  it('has a sign-correct cross-derivative structure', () => {
    // A flipped sign in any component would break the cancellation above, but
    // pin the magnitude too so a degenerate all-zero field cannot pass.
    const out = new Vector3()
    let maxLen = 0
    for (let i = 0; i < 50; i++) {
      curl3(i * 0.37, i * 0.11, i * 0.53, out)
      maxLen = Math.max(maxLen, out.length())
    }
    expect(maxLen).toBeGreaterThan(0.5)
  })
})
