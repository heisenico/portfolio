/**
 * Cat behaviour.
 *
 * A pure state machine over time and a single `hovered` input, producing a
 * pose. No geometry, no WebGL, no DOM — which is what makes the whole
 * behaviour testable, including the parts that are hardest to eyeball, like
 * whether the cat ever teleports between states.
 *
 * Hover is only honoured while perched. A cat that could be startled mid-leap
 * would snap to a new arc from an arbitrary point, and the leap is the one
 * moment the motion has to stay committed.
 */

import { Vector3 } from 'three'
import type { Perch } from './BranchSystem'
import type { CatPose } from './CatPose'
import { clamp01, easeInOutCubic, easeInQuad, easeOutBack, easeOutCubic } from '../util/tween'
import { mulberry32 } from '../util/rng'

export type CatState =
  | 'absent'
  | 'approach'
  | 'crouch'
  | 'leap'
  | 'perch'
  | 'startle'
  | 'flee'
  | 'fled'

export const DURATIONS = {
  /** Time off-stage before the cat comes back. */
  absent: 3.2,
  approach: 2.4,
  crouch: 0.55,
  leap: 0.95,
  /** Minimum time perched before hover is honoured, so it cannot be cut short. */
  perchSettle: 0.6,
  startle: 0.24,
  flee: 1.3,
  fled: 0,
} as const

/** Ground level the cat walks on. */
const GROUND_Y = -2.4
/** How far out the cat enters from. */
const ENTRY_DISTANCE = 15
/** Horizontal distance from directly below the perch to the launch mark. */
const LAUNCH_OFFSET = 3.4
/** Peak height of the leap above the straight line from launch to perch. */
const LEAP_ARC = 2.6
const FLEE_ARC = 3.4
const FLEE_DISTANCE = 14

export class CatBrain {
  private current: CatState = 'absent'
  private elapsed = 0
  private rng: () => number
  private perchIndex: number

  private readonly from = new Vector3()
  private readonly to = new Vector3()
  private readonly pose: CatPose = {
    position: new Vector3(),
    facing: 0,
    crouch: 0,
    squash: 0,
    tailPhase: 0,
    earPerk: 0,
    balance: 0,
    visible: false,
    opacity: 0,
  }

  private tail = 0

  constructor(
    private perches: Perch[],
    seed = 4242,
  ) {
    if (perches.length === 0) {
      throw new Error('CatBrain needs at least one perch to leap to')
    }
    this.rng = mulberry32(seed)
    this.perchIndex = Math.floor(this.rng() * perches.length)
    this.pose.position.set(0, GROUND_Y, ENTRY_DISTANCE)
  }

  get state(): CatState {
    return this.current
  }

  /** Where the cat is heading, for the hover proxy to follow. */
  get targetPerch(): Perch {
    return this.perches[this.perchIndex]!
  }

  update(dt: number, hovered: boolean): CatPose {
    this.elapsed += dt
    // The tail keeps moving in every state, including off-stage, so it never
    // snaps to a new phase when the cat reappears.
    this.tail += dt * (1.6 + this.pose.balance * 2.2)

    this.advance(hovered)
    this.applyPose()
    return this.pose
  }

  private advance(hovered: boolean): void {
    const d = DURATIONS

    switch (this.current) {
      case 'absent':
        if (this.elapsed >= d.absent) this.enter('approach')
        break
      case 'approach':
        if (this.elapsed >= d.approach) this.enter('crouch')
        break
      case 'crouch':
        if (this.elapsed >= d.crouch) this.enter('leap')
        break
      case 'leap':
        // Hover is deliberately ignored here.
        if (this.elapsed >= d.leap) this.enter('perch')
        break
      case 'perch':
        if (hovered && this.elapsed >= d.perchSettle) this.enter('startle')
        break
      case 'startle':
        if (this.elapsed >= d.startle) this.enter('flee')
        break
      case 'flee':
        if (this.elapsed >= d.flee) this.enter('fled')
        break
      case 'fled':
        this.enter('absent')
        break
    }
  }

  private enter(next: CatState): void {
    this.current = next
    this.elapsed = 0

    switch (next) {
      case 'approach': {
        // Choose a different perch each cycle so the loop does not repeat.
        if (this.perches.length > 1) {
          this.perchIndex = (this.perchIndex + 1 + Math.floor(this.rng() * (this.perches.length - 1))) % this.perches.length
        }
        const perch = this.targetPerch
        const launch = this.launchMark(perch)
        const away = new Vector3(launch.x, GROUND_Y, launch.z).normalize()
        this.from.set(away.x * ENTRY_DISTANCE, GROUND_Y, away.z * ENTRY_DISTANCE)
        this.to.copy(launch)
        // Snap now, while opacity is still 0, so the first visible frame is
        // already on the walk-in path.
        this.pose.position.copy(this.from)
        break
      }
      case 'crouch':
        this.from.copy(this.to)
        break
      case 'leap':
        this.from.copy(this.to)
        this.to.copy(this.targetPerch.position)
        break
      case 'perch':
        this.from.copy(this.to)
        break
      case 'startle':
        this.from.copy(this.to)
        break
      case 'flee': {
        this.from.copy(this.to)
        // Bolt outward, away from the trunk, and down past the frame edge.
        const outward = new Vector3(this.from.x, 0, this.from.z)
        if (outward.lengthSq() < 1e-6) outward.set(1, 0, 0)
        outward.normalize()
        this.to.set(
          this.from.x + outward.x * FLEE_DISTANCE,
          GROUND_Y - 4,
          this.from.z + outward.z * FLEE_DISTANCE,
        )
        break
      }
      case 'absent':
        this.pose.position.copy(this.to)
        break
      default:
        break
    }
  }

  /** A point on the ground, offset horizontally from directly under the perch. */
  private launchMark(perch: Perch): Vector3 {
    const horizontal = new Vector3(perch.position.x, 0, perch.position.z)
    if (horizontal.lengthSq() < 1e-6) horizontal.set(1, 0, 0)
    horizontal.normalize()
    return new Vector3(
      perch.position.x + horizontal.x * LAUNCH_OFFSET,
      GROUND_Y,
      perch.position.z + horizontal.z * LAUNCH_OFFSET,
    )
  }

  private applyPose(): void {
    const d = DURATIONS
    const p = this.pose
    p.tailPhase = this.tail

    switch (this.current) {
      case 'absent':
      case 'fled':
        p.visible = false
        p.opacity = 0
        p.crouch = 0
        p.squash = 0
        p.earPerk = 0
        p.balance = 0
        break

      case 'approach': {
        const t = clamp01(this.elapsed / d.approach)
        // Fade in over the first stretch rather than popping into existence.
        p.opacity = clamp01(t * 4)
        p.visible = p.opacity > 0.001
        p.position.lerpVectors(this.from, this.to, easeInOutCubic(t))
        p.facing = this.faceAlong(this.from, this.to)
        // A four-beat walk bob.
        p.crouch = 0.12 + Math.sin(t * Math.PI * 12) * 0.06
        p.squash = Math.sin(t * Math.PI * 12) * 0.08
        p.earPerk = 0.25
        p.balance = 0
        break
      }

      case 'crouch': {
        const t = clamp01(this.elapsed / d.crouch)
        p.visible = true
        p.opacity = 1
        p.position.copy(this.from)
        p.facing = this.faceAlong(this.from, this.targetPerch.position)
        // Sink low, then coil tight just before the launch.
        p.crouch = easeOutCubic(t) * 0.85
        p.squash = easeOutCubic(t) * 0.55
        p.earPerk = 0.85
        p.balance = 0.2
        break
      }

      case 'leap': {
        const t = clamp01(this.elapsed / d.leap)
        p.visible = true
        p.opacity = 1
        p.position.lerpVectors(this.from, this.to, t)
        // Parabola peaks at mid-flight and returns to zero at both ends, so the
        // arc lands exactly on the perch.
        p.position.y += Math.sin(t * Math.PI) * LEAP_ARC
        p.facing = this.faceAlong(this.from, this.to)
        // Stretch out of the crouch, compress on landing.
        p.squash = t < 0.25 ? -0.55 * (1 - t / 0.25) : -0.2 + easeInQuad(t) * 0.7
        p.crouch = 0.15
        p.earPerk = 1
        p.balance = 0.1
        break
      }

      case 'perch': {
        const t = this.elapsed
        p.visible = true
        p.opacity = 1
        p.position.copy(this.from)
        p.facing = this.faceAlong(new Vector3(0, this.from.y, 0), this.from)
        // Absorb the landing, then settle.
        const settle = clamp01(t / 0.45)
        p.squash = (1 - easeOutBack(settle)) * 0.5
        p.crouch = 0.35 + Math.sin(t * 1.1) * 0.05
        p.earPerk = 0.3 + Math.sin(t * 0.7) * 0.2
        p.balance = 1
        break
      }

      case 'startle': {
        const t = clamp01(this.elapsed / d.startle)
        p.visible = true
        p.opacity = 1
        p.position.copy(this.from)
        // A sharp flinch upward before the push-off.
        p.position.y += Math.sin(t * Math.PI) * 0.12
        p.crouch = 0.9
        p.squash = 0.75
        p.earPerk = 1
        p.balance = 1
        break
      }

      case 'flee': {
        const t = clamp01(this.elapsed / d.flee)
        p.visible = true
        p.position.lerpVectors(this.from, this.to, easeInQuad(t))
        p.position.y += Math.sin(t * Math.PI) * FLEE_ARC
        p.facing = this.faceAlong(this.from, this.to)
        p.squash = -0.6
        p.crouch = 0.1
        p.earPerk = 1
        p.balance = 0.4
        // Dissolve out over the back half of the arc.
        p.opacity = 1 - clamp01((t - 0.45) / 0.55)
        p.visible = p.opacity > 0.001
        break
      }
    }
  }

  private faceAlong(from: Vector3, to: Vector3): number {
    const dx = to.x - from.x
    const dz = to.z - from.z
    if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return this.pose.facing
    return Math.atan2(dx, dz)
  }
}
