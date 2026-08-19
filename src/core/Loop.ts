/**
 * The single requestAnimationFrame driver.
 *
 * No subsystem starts a loop of its own. They register a tick function here and
 * are called in registration order, which `main.ts` fixes deliberately: input,
 * then behaviour, then rendering.
 */

export type Tick = (dt: number, elapsed: number) => void

/**
 * A tab restored after minutes in the background would otherwise report a
 * multi-minute delta and teleport every animation. Clamp hard.
 */
const MAX_DT = 0.05

export class Loop {
  private ticks: Tick[] = []
  private raf = 0
  private last = 0
  private running = false

  elapsed = 0
  /** Duration of the last frame in milliseconds, for the quality probe. */
  frameMs = 16.7

  add(fn: Tick): void {
    this.ticks.push(fn)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    document.addEventListener('visibilitychange', this.onVisibility)
    this.raf = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf)
    } else if (this.running) {
      // Resume without charging the animation for the time spent hidden.
      this.last = performance.now()
      this.raf = requestAnimationFrame(this.frame)
    }
  }

  /**
   * Advance one frame without waiting for RAF, for deterministic verification.
   * Nothing in the running site calls this.
   */
  stepManual(dt: number): void {
    this.elapsed += dt
    for (const tick of this.ticks) tick(dt, this.elapsed)
  }

  private frame = (now: number): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)

    this.frameMs = now - this.last
    const dt = Math.min(this.frameMs / 1000, MAX_DT)
    this.last = now
    this.elapsed += dt

    for (const tick of this.ticks) tick(dt, this.elapsed)
  }
}
