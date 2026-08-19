/**
 * Pointer state in the forms the rest of the world needs it.
 *
 * Raw events are noisy and arrive at a rate unrelated to the frame rate, so
 * everything downstream reads the smoothed values sampled once per tick.
 */

import { Vector2, Vector3, type PerspectiveCamera } from 'three'
import { damp } from '../util/tween'

export class Pointer {
  /** Normalised device coordinates, -1..1, y up. */
  readonly ndc = new Vector2(0, 0)
  /** `ndc` with damping applied — what the camera rig follows. */
  readonly smooth = new Vector2(0, 0)
  /** NDC units per second. Drives pointer-trail emission rate. */
  readonly velocity = new Vector2(0, 0)
  /** Pointer position projected onto the focal plane, in world space. */
  readonly world = new Vector3(0, 6, 0)

  isDown = false
  /** Seconds since the pointer last moved. */
  idleFor = 0
  /** False until the first real pointer event — touch devices may never fire one. */
  hasMoved = false

  private raw = new Vector2(0, 0)
  private previous = new Vector2(0, 0)
  private readonly ray = new Vector3()

  constructor(
    private camera: PerspectiveCamera,
    /** Distance from the camera at which `world` is computed. */
    public focalDistance = 26,
  ) {
    window.addEventListener('pointermove', this.onMove, { passive: true })
    window.addEventListener('pointerdown', this.onDown, { passive: true })
    window.addEventListener('pointerup', this.onUp, { passive: true })
    window.addEventListener('pointercancel', this.onUp, { passive: true })
    window.addEventListener('blur', this.onUp)
  }

  private onMove = (e: PointerEvent): void => {
    this.raw.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    this.idleFor = 0
    this.hasMoved = true
  }

  private onDown = (): void => {
    this.isDown = true
  }

  private onUp = (): void => {
    this.isDown = false
  }

  update(dt: number): void {
    this.idleFor += dt

    this.previous.copy(this.ndc)
    this.ndc.copy(this.raw)

    this.smooth.set(
      damp(this.smooth.x, this.ndc.x, 5, dt),
      damp(this.smooth.y, this.ndc.y, 5, dt),
    )

    if (dt > 0) {
      const vx = (this.ndc.x - this.previous.x) / dt
      const vy = (this.ndc.y - this.previous.y) / dt
      // Damp the velocity too — raw per-frame deltas are extremely spiky.
      this.velocity.set(damp(this.velocity.x, vx, 14, dt), damp(this.velocity.y, vy, 14, dt))
    }

    this.projectToWorld()
  }

  private projectToWorld(): void {
    this.ray.set(this.ndc.x, this.ndc.y, 0.5).unproject(this.camera)
    this.ray.sub(this.camera.position).normalize()
    this.world.copy(this.camera.position).addScaledVector(this.ray, this.focalDistance)
  }

  /** Magnitude of the smoothed velocity. */
  get speed(): number {
    return this.velocity.length()
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
    window.removeEventListener('blur', this.onUp)
  }
}
