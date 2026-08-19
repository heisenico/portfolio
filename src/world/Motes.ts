/**
 * The ambient particle field — the layer that makes the world feel inhabited
 * rather than modelled.
 *
 * Buffers are allocated once at the tier chosen before the first frame. A later
 * downgrade shrinks the draw range rather than reallocating, so quality can
 * drop mid-session without a hitch.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  type Vector3,
} from 'three'
import { motesFragment, motesVertex } from '../fx/shaders/motes'
import type { Quality } from '../core/Quality'
import { mulberry32, randRange } from '../util/rng'

const FIELD_RADIUS = 19
const FIELD_HEIGHT = 27
const RISE_HEIGHT = 34
const SWIRL = 2.4
const POINTER_STRENGTH = 5.5
const POINTER_RADIUS = 5.0

export class Motes {
  readonly points: Points
  private material: ShaderMaterial
  private geometry: BufferGeometry
  private allocated: number

  constructor(
    private quality: Quality,
    scanOrigin: Vector3,
    seed = 1337,
    color = 0x7fd8ff,
  ) {
    this.allocated = quality.allocation.motes
    const rng = mulberry32(seed)

    const base = new Float32Array(this.allocated * 3)
    const seeds = new Float32Array(this.allocated)
    const scales = new Float32Array(this.allocated)

    for (let i = 0; i < this.allocated; i++) {
      // Rejection-free disc sampling: sqrt keeps the density even rather than
      // clumping everything at the centre.
      const angle = rng() * Math.PI * 2
      const radius = Math.sqrt(rng()) * FIELD_RADIUS
      base[i * 3] = Math.cos(angle) * radius
      base[i * 3 + 1] = randRange(rng, -4, FIELD_HEIGHT)
      base[i * 3 + 2] = Math.sin(angle) * radius
      seeds[i] = rng()
      // A few large motes among many small ones reads as depth.
      scales[i] = 0.35 + Math.pow(rng(), 3) * 1.9
    }

    this.geometry = new BufferGeometry()
    this.geometry.setAttribute('position', new BufferAttribute(base, 3))
    this.geometry.setAttribute('aBase', new BufferAttribute(base, 3))
    this.geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    this.geometry.setAttribute('aScale', new BufferAttribute(scales, 1))

    this.material = new ShaderMaterial({
      vertexShader: motesVertex,
      fragmentShader: motesFragment,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 4.6 },
        uDpr: { value: 1 },
        uColor: { value: new Color(color) },
        uOpacity: { value: 0.85 },
        uPointer: { value: scanOrigin.clone() },
        uPointerStrength: { value: POINTER_STRENGTH },
        uPointerRadius: { value: POINTER_RADIUS },
        uRevealRadius: { value: 0 },
        uScanOrigin: { value: scanOrigin.clone() },
        uRiseHeight: { value: RISE_HEIGHT },
        uSwirl: { value: SWIRL },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    this.points = new Points(this.geometry, this.material)
    this.points.frustumCulled = false

    this.applyQuality()
    quality.onDowngrade(() => this.applyQuality())
  }

  /** Draw only the share of the buffer the current tier can afford. */
  private applyQuality(): void {
    const active = Math.max(1, Math.round(this.allocated * this.quality.activeFraction))
    this.geometry.setDrawRange(0, active)
  }

  setDpr(dpr: number): void {
    this.material.uniforms['uDpr']!.value = dpr
  }

  /**
   * @param reveal 0..1 across the intro sweep. Scaled here to a radius that
   *        certainly encloses the field, so reveal === 1 shows every mote.
   */
  update(_dt: number, elapsed: number, pointerWorld: Vector3, reveal: number): void {
    this.material.uniforms['uTime']!.value = elapsed
    this.material.uniforms['uPointer']!.value.copy(pointerWorld)
    this.material.uniforms['uRevealRadius']!.value = reveal * Motes.FIELD_DIAGONAL
  }

  /** Furthest a mote can ever sit from the scan origin, plus headroom. */
  static readonly FIELD_DIAGONAL = Math.hypot(FIELD_RADIUS, FIELD_HEIGHT + RISE_HEIGHT) + 6

  get drawn(): number {
    return this.geometry.drawRange.count
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
