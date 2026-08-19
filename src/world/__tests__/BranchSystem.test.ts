import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { generateBranches } from '../BranchSystem'

describe('generateBranches', () => {
  it('is byte-identical for the same seed', () => {
    const a = generateBranches({ seed: 7 })
    const b = generateBranches({ seed: 7 })
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions))
    expect(Array.from(a.markerOffsets)).toEqual(Array.from(b.markerOffsets))
    expect(a.perches.length).toBe(b.perches.length)
  })

  it('differs between seeds', () => {
    const a = generateBranches({ seed: 1 })
    const b = generateBranches({ seed: 2 })
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions))
  })

  it('emits whole line segments', () => {
    const t = generateBranches({ seed: 3 })
    expect(t.positions.length % 6).toBe(0)
    expect(t.segmentCount).toBe(t.positions.length / 6)
    expect(t.segmentCount).toBeGreaterThan(200)
  })

  it('keeps every per-vertex attribute in step with positions', () => {
    const t = generateBranches({ seed: 4 })
    const vertexCount = t.positions.length / 3
    expect(t.distances.length).toBe(vertexCount)
    expect(t.depths.length).toBe(vertexCount)
  })

  it('keeps every per-marker attribute in step', () => {
    const t = generateBranches({ seed: 5 })
    expect(t.markerOffsets.length).toBe(t.markerCount * 3)
    expect(t.markerScales.length).toBe(t.markerCount)
    expect(t.markerDistances.length).toBe(t.markerCount)
    expect(t.markerSeeds.length).toBe(t.markerCount)
    expect(t.markerCount).toBeGreaterThan(50)
  })

  it('measures distances from the scan origin, and bounds contains them all', () => {
    const origin = new Vector3(0, 6.5, 0)
    const t = generateBranches({ seed: 6, origin })
    const p = new Vector3()
    let maxSeen = 0
    for (let i = 0; i < t.distances.length; i++) {
      p.fromArray(t.positions, i * 3)
      expect(t.distances[i]!).toBeCloseTo(p.distanceTo(origin), 4)
      maxSeen = Math.max(maxSeen, t.distances[i]!)
    }
    expect(t.bounds).toBeCloseTo(maxSeen, 4)
    expect(t.bounds).toBeGreaterThan(5)
  })

  it('produces usable perches across many seeds and depths', () => {
    // The cat has nowhere to go if a seed yields no perch, so this is checked
    // broadly rather than on one lucky seed.
    for (const seed of [1, 8, 42, 777, 20260819]) {
      for (const depth of [4, 5, 6, 7]) {
        const t = generateBranches({ seed, depth })
        expect(t.perches.length, `seed ${seed} depth ${depth}`).toBeGreaterThanOrEqual(4)
        for (const perch of t.perches) {
          expect(perch.position.y).toBeGreaterThan(4)
          expect(perch.position.y).toBeLessThan(15)
          // Out on a limb, not hugging the trunk.
          expect(Math.hypot(perch.position.x, perch.position.z)).toBeGreaterThan(2.2)
          // Roughly horizontal, so a cat could plausibly stand there.
          expect(Math.abs(perch.along.y)).toBeLessThan(0.7)
          expect(perch.along.length()).toBeCloseTo(1, 5)
        }
      }
    }
  })

  it('keeps chosen perches far enough apart to read as distinct leaps', () => {
    const t = generateBranches({ seed: 20260819 })
    for (let i = 0; i < t.perches.length; i++) {
      for (let j = i + 1; j < t.perches.length; j++) {
        expect(t.perches[i]!.position.distanceTo(t.perches[j]!.position)).toBeGreaterThanOrEqual(
          2.5,
        )
      }
    }
  })

  it('places every perch on a vertex the tree actually contains', () => {
    const t = generateBranches({ seed: 9 })
    const p = new Vector3()
    for (const perch of t.perches) {
      let nearest = Infinity
      for (let i = 0; i < t.positions.length; i += 3) {
        p.fromArray(t.positions, i)
        nearest = Math.min(nearest, p.distanceTo(perch.position))
      }
      expect(nearest).toBeLessThan(1e-4)
    }
  })

  it('produces only finite coordinates', () => {
    const t = generateBranches({ seed: 11 })
    expect(t.positions.every(Number.isFinite)).toBe(true)
    expect(t.markerOffsets.every(Number.isFinite)).toBe(true)
  })

  it('grows monotonically with depth', () => {
    // Not a fixed ratio: depths 0-2 are drawn as wireframe tubes and contribute
    // a large constant base, so each extra level adds proportionally less.
    const counts = [3, 4, 5, 6, 7].map((depth) => generateBranches({ seed: 12, depth }).segmentCount)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!, `depth ${i + 3}`).toBeGreaterThan(counts[i - 1]!)
    }
  })

  it('gives thick branches real width by tubing them', () => {
    // A tubed branch emits RING_SEGMENTS rails plus RING_SEGMENTS hoops per
    // subdivision, so a depth-0-only tree is far denser than a single line.
    const t = generateBranches({ seed: 12, depth: 0 })
    expect(t.segmentCount).toBeGreaterThan(50)

    // And those vertices are genuinely off-axis, not collinear.
    let maxOffAxis = 0
    for (let i = 0; i < t.positions.length; i += 3) {
      maxOffAxis = Math.max(maxOffAxis, Math.hypot(t.positions[i]!, t.positions[i + 2]!))
    }
    expect(maxOffAxis).toBeGreaterThan(0.2)
  })
})
