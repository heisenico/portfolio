/**
 * The opening sequence.
 *
 * Owns the wavefront radius for the duration of the intro and hands it over
 * pinned at maximum afterwards. Everything else — the shell, the ground, the
 * motes — reads that radius, so this is the only clock the reveal needs.
 *
 * Skippable at any point. A three-second intro is fine once and tiresome on
 * the fourth visit, so click, tap, key, or scroll all cut to the end.
 */

import type { Quality } from '../core/Quality'
import type { ScanReveal } from '../world/ScanReveal'
import { Timeline, clamp01, easeOutQuint } from '../util/tween'
import type { CardScan } from './CardScan'

const IGNITE_AT = 0.25
const SWEEP_DURATION = 2.9
const REDUCED_FADE_MS = 420

export class Intro {
  private timeline = new Timeline()
  private clock = 0
  private finished = false
  private skipped = false

  constructor(
    private scan: ScanReveal,
    private cardScan: CardScan,
    quality: Quality,
    private veil: HTMLElement | null,
  ) {
    if (quality.reducedMotion) {
      this.runReduced()
      return
    }

    this.timeline
      .at(0.05, () => this.veil?.classList.add('is-lifted'))
      .at(2.35, () => this.cardScan.start())
      .at(IGNITE_AT + SWEEP_DURATION + 0.3, () => {
        this.finished = true
      })

    addEventListener('pointerdown', this.onSkip)
    addEventListener('keydown', this.onSkip)
    addEventListener('wheel', this.onSkip, { passive: true })
    addEventListener('touchstart', this.onSkip, { passive: true })
  }

  private runReduced(): void {
    // No sweep: the scan is a motion effect, and this is exactly the user who
    // asked for less of it. The world is simply already there.
    this.scan.setRadius(this.scan.maxRadius)
    this.veil?.classList.add('is-lifted')
    if (this.veil) this.veil.style.transitionDuration = `${REDUCED_FADE_MS}ms`
    this.cardScan.start()
    this.finished = true
  }

  private onSkip = (): void => {
    if (this.finished || this.skipped) return
    this.skipped = true
    this.timeline.skipToEnd()
    this.scan.setRadius(this.scan.maxRadius)
    this.finished = true
    this.detach()
  }

  private detach(): void {
    removeEventListener('pointerdown', this.onSkip)
    removeEventListener('keydown', this.onSkip)
    removeEventListener('wheel', this.onSkip)
    removeEventListener('touchstart', this.onSkip)
  }

  update(dt: number): void {
    if (this.finished) {
      // Keep it pinned: other systems read the radius every frame.
      this.scan.setRadius(this.scan.maxRadius)
      return
    }

    this.clock += dt
    this.timeline.update(dt)

    const t = clamp01((this.clock - IGNITE_AT) / SWEEP_DURATION)
    // Fast out of the gate, easing as it clears the canopy — a linear sweep
    // reads as a mechanical wipe rather than a pulse.
    this.scan.setRadius(this.scan.maxRadius * easeOutQuint(t))
  }

  get done(): boolean {
    return this.finished
  }

  dispose(): void {
    this.detach()
  }
}
