import { beforeEach, describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { CatBrain, DURATIONS, type CatState } from '../CatBrain'
import type { Perch } from '../BranchSystem'
import { generateBranches } from '../BranchSystem'

const TICK = 1 / 60

function perches(): Perch[] {
  return [
    { position: new Vector3(4, 8, 1), along: new Vector3(1, 0, 0) },
    { position: new Vector3(-3, 9.5, 2), along: new Vector3(0, 0, 1) },
    { position: new Vector3(1, 7, -4), along: new Vector3(1, 0, 0).normalize() },
  ]
}

/** Step until the brain reports the given state. TS narrows a getter across a
 * loop condition, so the state is read through a function to keep it honest. */
function runTo(brain: CatBrain, target: CatState, hovered = false, maxSeconds = 60): void {
  let t = 0
  while (brain.state !== target) {
    brain.update(TICK, hovered)
    t += TICK
    if (t > maxSeconds) throw new Error(`never reached ${target}`)
  }
}

/** Run until the state changes or the budget runs out. */
function runUntilStateChange(brain: CatBrain, hovered = false, maxSeconds = 30): CatState {
  const start = brain.state
  let t = 0
  while (t < maxSeconds) {
    brain.update(TICK, hovered)
    t += TICK
    if (brain.state !== start) return brain.state
  }
  throw new Error(`stuck in ${start} for ${maxSeconds}s`)
}

function advance(brain: CatBrain, seconds: number, hovered = false): void {
  for (let t = 0; t < seconds; t += TICK) brain.update(TICK, hovered)
}

describe('CatBrain', () => {
  let brain: CatBrain

  beforeEach(() => {
    brain = new CatBrain(perches(), 1)
  })

  it('refuses to run without a perch', () => {
    expect(() => new CatBrain([], 1)).toThrow(/perch/)
  })

  it('starts absent and invisible', () => {
    expect(brain.state).toBe('absent')
    expect(brain.update(TICK, false).visible).toBe(false)
  })

  it('walks the full cycle in order and returns to absent', () => {
    const seen: CatState[] = [brain.state]
    for (let i = 0; i < 8; i++) {
      // Hover only matters at `perch`; passing it throughout proves the other
      // states ignore it.
      seen.push(runUntilStateChange(brain, true))
      if (seen[seen.length - 1] === 'absent') break
    }
    expect(seen).toEqual([
      'absent',
      'approach',
      'crouch',
      'leap',
      'perch',
      'startle',
      'flee',
      'fled',
      'absent',
    ])
  })

  it('stays perched indefinitely when nothing hovers it', () => {
    advance(brain, DURATIONS.absent + DURATIONS.approach + DURATIONS.crouch + DURATIONS.leap + 0.2)
    expect(brain.state).toBe('perch')
    advance(brain, 20, false)
    expect(brain.state).toBe('perch')
  })

  it('does not let a hover interrupt the leap', () => {
    advance(brain, DURATIONS.absent + DURATIONS.approach + DURATIONS.crouch + 0.05)
    expect(brain.state).toBe('leap')
    // Hover hard, mid-arc.
    advance(brain, DURATIONS.leap * 0.5, true)
    expect(brain.state).toBe('leap')
  })

  it('ignores a hover during the settle window, then honours it', () => {
    advance(brain, DURATIONS.absent + DURATIONS.approach + DURATIONS.crouch + DURATIONS.leap + 0.02)
    expect(brain.state).toBe('perch')
    advance(brain, DURATIONS.perchSettle * 0.5, true)
    expect(brain.state).toBe('perch')
    // Just past the settle window — startle is short, so overshooting here
    // would run straight through into flee.
    advance(brain, DURATIONS.perchSettle * 0.6, true)
    expect(brain.state).toBe('startle')
  })

  it('lands exactly on the perch it aimed at', () => {
    advance(brain, DURATIONS.absent + DURATIONS.approach + DURATIONS.crouch + DURATIONS.leap + 0.05)
    expect(brain.state).toBe('perch')
    const pose = brain.update(TICK, false)
    expect(pose.position.distanceTo(brain.targetPerch.position)).toBeLessThan(0.01)
  })

  it('never teleports while on screen', () => {
    const previous = new Vector3()
    let wasVisible = false
    let worst = 0
    let worstAt = ''

    // Long enough to cover several complete cycles, hovering throughout.
    for (let i = 0; i < 60 / TICK; i++) {
      const pose = brain.update(TICK, true)
      // Only consecutive on-screen frames matter. Repositioning behind a
      // completed fade is how the cat gets back to its entry point at all.
      if (wasVisible && pose.visible) {
        const jump = pose.position.distanceTo(previous)
        if (jump > worst) {
          worst = jump
          worstAt = brain.state
        }
      }
      previous.copy(pose.position)
      wasVisible = pose.visible
    }

    // This guards against teleports, not speed. The fastest intended motion is
    // the flee bolt at roughly 0.6 units/frame; the bug this caught was a
    // 33-unit snap when the cat repositioned for its walk-in while still
    // on screen.
    expect(worst, `largest jump occurred in ${worstAt}`).toBeLessThan(1.0)
  })

  it('keeps opacity within range and fades rather than popping', () => {
    for (let i = 0; i < 40 / TICK; i++) {
      const pose = brain.update(TICK, true)
      expect(pose.opacity).toBeGreaterThanOrEqual(0)
      expect(pose.opacity).toBeLessThanOrEqual(1)
      if (pose.visible) expect(pose.opacity).toBeGreaterThan(0)
    }
  })

  it('produces only finite pose values', () => {
    for (let i = 0; i < 30 / TICK; i++) {
      const p = brain.update(TICK, true)
      for (const v of [p.position.x, p.position.y, p.position.z, p.facing, p.crouch, p.squash]) {
        expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('varies its perch between cycles', () => {
    const visited = new Set<string>()
    for (let cycle = 0; cycle < 6; cycle++) {
      runTo(brain, 'perch')
      visited.add(brain.targetPerch.position.toArray().join(','))
      runTo(brain, 'absent', true)
    }
    expect(visited.size).toBeGreaterThan(1)
  })

  it('works with a single perch', () => {
    const solo = new CatBrain([{ position: new Vector3(3, 8, 0), along: new Vector3(1, 0, 0) }], 5)
    runTo(solo, 'perch')
    expect(solo.state).toBe('perch')
  })

  it('drives from real generated perches', () => {
    const tree = generateBranches({ seed: 20260819 })
    const real = new CatBrain(tree.perches, 9)
    runTo(real, 'perch')
    const pose = real.update(TICK, false)
    expect(pose.position.y).toBeGreaterThan(4)
    expect(pose.visible).toBe(true)
  })

  it('advances the tail continuously, including while off-stage', () => {
    const a = brain.update(TICK, false).tailPhase
    advance(brain, 1)
    const b = brain.update(TICK, false).tailPhase
    expect(b).toBeGreaterThan(a)
  })
})
