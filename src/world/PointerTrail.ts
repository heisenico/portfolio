/**
 * Particles emitted from the cursor.
 *
 * Unlike the mote field this is genuinely stateful — each particle has its own
 * velocity and lifetime — so it runs on the CPU over a fixed ring buffer. No
 * allocation happens after construction: dead particles are overwritten in
 * place, which keeps the GC out of the frame loop entirely.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { Pointer } from '../core/Pointer'
import type { Quality } from '../core/Quality'
import { trailFragment, trailVertex } from '../fx/shaders/trail'
import { mulberry32 } from '../util/rng'

const LIFETIME = 1.25
/** Particles per second at full pointer speed. */
const MAX_EMIT_RATE = 90
/** Pointer speed, in NDC units per second, that saturates the emission rate. */
const SPEED_SATURATION = 2.2
const DRAG = 1.9
const RISE = 0.55

export class PointerTrail {
  readonly points: Points
  private material: ShaderMaterial
  private geometry: BufferGeometry

  private capacity: number
  private cursor = 0
  private live = 0

  private positions: Float32Array
  private ages: Float32Array
  private lives: Float32Array
  private seeds: Float32Array
  private velocities: Float32Array

  private posAttr: BufferAttribute
  private ageAttr: BufferAttribute
  private lifeAttr: BufferAttribute
  private seedAttr: BufferAttribute

  private emitDebt = 0
  private rng = mulberry32(90210)
  private lastPointer = new Vector3()
  private hasLast = false

  constructor(quality: Quality, color = 0xa8f0ff) {
    this.capacity = quality.allocation.trail

    this.positions = new Float32Array(this.capacity * 3)
    this.velocities = new Float32Array(this.capacity * 3)
    this.ages = new Float32Array(this.capacity)
    this.lives = new Float32Array(this.capacity)
    this.seeds = new Float32Array(this.capacity)

    // Dead until emitted: age past life makes the shader collapse them.
    this.ages.fill(1)
    this.lives.fill(1)

    this.geometry = new BufferGeometry()
    this.posAttr = new BufferAttribute(this.positions, 3)
    this.ageAttr = new BufferAttribute(this.ages, 1)
    this.lifeAttr = new BufferAttribute(this.lives, 1)
    this.seedAttr = new BufferAttribute(this.seeds, 1)
    this.posAttr.setUsage(35048 /* DynamicDrawUsage */)
    this.ageAttr.setUsage(35048)

    this.geometry.setAttribute('position', this.posAttr)
    this.geometry.setAttribute('aAge', this.ageAttr)
    this.geometry.setAttribute('aLife', this.lifeAttr)
    this.geometry.setAttribute('aSeed', this.seedAttr)

    this.material = new ShaderMaterial({
      vertexShader: trailVertex,
      fragmentShader: trailFragment,
      uniforms: {
        uSize: { value: 7.5 },
        uDpr: { value: 1 },
        uColor: { value: new Color(color) },
        uHot: { value: new Color(0xffffff) },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    this.points = new Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  setDpr(dpr: number): void {
    this.material.uniforms['uDpr']!.value = dpr
  }

  update(dt: number, pointer: Pointer): void {
    this.advance(dt)
    this.emit(dt, pointer)

    this.posAttr.needsUpdate = true
    this.ageAttr.needsUpdate = true
    this.lifeAttr.needsUpdate = true
    this.seedAttr.needsUpdate = true
  }

  private advance(dt: number): void {
    let live = 0
    const drag = Math.exp(-DRAG * dt)

    for (let i = 0; i < this.capacity; i++) {
      if (this.ages[i]! >= this.lives[i]!) continue
      live++

      this.ages[i] = this.ages[i]! + dt

      const o = i * 3
      this.velocities[o] = this.velocities[o]! * drag
      this.velocities[o + 1] = this.velocities[o + 1]! * drag + RISE * dt
      this.velocities[o + 2] = this.velocities[o + 2]! * drag

      this.positions[o] = this.positions[o]! + this.velocities[o]! * dt
      this.positions[o + 1] = this.positions[o + 1]! + this.velocities[o + 1]! * dt
      this.positions[o + 2] = this.positions[o + 2]! + this.velocities[o + 2]! * dt
    }

    this.live = live
  }

  private emit(dt: number, pointer: Pointer): void {
    if (!pointer.hasMoved) return

    const speed = Math.min(pointer.speed / SPEED_SATURATION, 1)
    // A resting pointer still breathes out a few particles, so the cursor never
    // goes completely dead.
    const rate = MAX_EMIT_RATE * (0.06 + speed * 0.94)

    this.emitDebt += rate * dt
    const count = Math.floor(this.emitDebt)
    this.emitDebt -= count
    if (count <= 0) {
      this.lastPointer.copy(pointer.world)
      this.hasLast = true
      return
    }

    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.capacity
      const o = i * 3

      // Spread emission along the path travelled this frame instead of stacking
      // them all at the current position, or fast movement leaves visible gaps.
      const t = this.hasLast ? (n + 1) / count : 1
      this.positions[o] = this.lastPointer.x + (pointer.world.x - this.lastPointer.x) * t
      this.positions[o + 1] = this.lastPointer.y + (pointer.world.y - this.lastPointer.y) * t
      this.positions[o + 2] = this.lastPointer.z + (pointer.world.z - this.lastPointer.z) * t

      const spread = 1.6
      this.velocities[o] = (this.rng() - 0.5) * spread
      this.velocities[o + 1] = (this.rng() - 0.5) * spread
      this.velocities[o + 2] = (this.rng() - 0.5) * spread

      this.ages[i] = 0
      this.lives[i] = LIFETIME * (0.6 + this.rng() * 0.8)
      this.seeds[i] = this.rng()
    }

    this.lastPointer.copy(pointer.world)
    this.hasLast = true
  }

  get liveCount(): number {
    return this.live
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
