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

export class CameraRig {
  readonly focus = new Vector3(0, 6.5, 0)
  radius = 30

  private azimuth = 0
  private polar = 0
  private gain = 1
  private drift = 0

  constructor(
    private camera: PerspectiveCamera,
    private pointer: Pointer,
    private quality: Quality,
  ) {}

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
