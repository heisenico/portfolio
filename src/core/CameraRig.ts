/**
 * Pointer-driven orbit, which is the whole parallax effect.
 *
 * Not OrbitControls: that requires a drag to do anything, and the world should
 * respond to a pointer that is merely present. The camera rides a fixed-radius
 * shell around the scene focus, its angles damped toward pointer-derived
 * targets, with a slow Lissajous drift summed underneath so the scene keeps
 * breathing when the pointer is still. Dragging widens the same range rather
 * than switching to a different control scheme.
 */

import { Vector3, type PerspectiveCamera } from 'three'
import { damp } from '../util/tween'
import type { Pointer } from './Pointer'
import type { Quality } from './Quality'

/** Angular reach of pointer parallax, in radians. */
const AZIMUTH_RANGE = 0.42
const POLAR_RANGE = 0.2
/** Dragging pushes past the hover range without changing the feel. */
const DRAG_GAIN = 2.4
const DRIFT_AZIMUTH = 0.055
const DRIFT_POLAR = 0.032
/** Reduced motion keeps parallax legible but drops it well below vestibular range. */
const REDUCED_SCALE = 0.3

/**
 * Margin applied to the subject's half-extents. 1.0 fits it exactly to the
 * frame edge; above 1 leaves air around it.
 *
 * Fitting a bounding *sphere* instead over-tightens the vertical, because a
 * tree's diagonal is much larger than its half-height — that cropped the
 * canopy on every viewport.
 */
const FIT_MARGIN = 1.06
const MIN_RADIUS = 12
const MAX_RADIUS = 60

export class CameraRig {
  readonly focus = new Vector3(0, 7.4, 0)
  radius = 21

  private halfWidth = 8
  private halfHeight = 10

  private azimuth = 0
  private polar = 0
  private gain = 1
  private drift = 0

  constructor(
    private camera: PerspectiveCamera,
    private pointer: Pointer,
    private quality: Quality,
  ) {}

  /**
   * Set the subject to keep in frame. The distance is then derived from the
   * camera's own field of view and aspect, so framing survives any viewport —
   * a hardcoded distance crops the canopy on a portrait phone and strands the
   * tree in the middle of an ultrawide.
   */
  frame(focus: Vector3, halfWidth: number, halfHeight: number): void {
    this.focus.copy(focus)
    this.halfWidth = halfWidth
    this.halfHeight = halfHeight
    this.refit()
  }

  /** Recompute the orbit distance. Call whenever the projection changes. */
  refit(): void {
    const vFov = (this.camera.fov * Math.PI) / 180
    const hHalfAngle = Math.atan(Math.tan(vFov / 2) * this.camera.aspect)

    // Distance at which each axis exactly fills its half-angle; take whichever
    // is further so both fit.
    const distance = Math.max(
      (this.halfHeight * FIT_MARGIN) / Math.tan(vFov / 2),
      (this.halfWidth * FIT_MARGIN) / Math.tan(hHalfAngle),
    )
    this.radius = Math.min(Math.max(distance, MIN_RADIUS), MAX_RADIUS)
  }

  update(dt: number, elapsed: number): void {
    const reduced = this.quality.reducedMotion
    const scale = reduced ? REDUCED_SCALE : 1

    this.gain = damp(this.gain, this.pointer.isDown ? DRAG_GAIN : 1, 4, dt)

    const targetAzimuth = -this.pointer.smooth.x * AZIMUTH_RANGE * this.gain * scale
    const targetPolar = this.pointer.smooth.y * POLAR_RANGE * this.gain * scale

    this.azimuth = damp(this.azimuth, targetAzimuth, 3.2, dt)
    this.polar = damp(this.polar, targetPolar, 3.2, dt)

    // Two incommensurable frequencies never repeat their pattern, so the idle
    // motion does not read as a loop.
    this.drift = reduced ? 0 : 1
    const driftAz = Math.sin(elapsed * 0.11) * DRIFT_AZIMUTH * this.drift
    const driftPo = Math.sin(elapsed * 0.077 + 1.3) * DRIFT_POLAR * this.drift

    const az = this.azimuth + driftAz
    const po = this.polar + driftPo

    const cosPo = Math.cos(po)
    this.camera.position.set(
      this.focus.x + Math.sin(az) * cosPo * this.radius,
      this.focus.y + Math.sin(po) * this.radius + 1.2,
      this.focus.z + Math.cos(az) * cosPo * this.radius,
    )
    this.camera.lookAt(this.focus)
  }
}
