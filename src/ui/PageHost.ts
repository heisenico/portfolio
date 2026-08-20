/**
 * Mounts one page at a time and cross-fades between them.
 *
 * Pages own their DOM and nothing else. The host owns the transition, the
 * parallax and the glass sheen — lifted out of the old `Cards` so that every
 * future page gets all three for free instead of reimplementing them.
 *
 * Rects are cached and recomputed only when layout could have changed. Reading
 * `getBoundingClientRect` for every pane every frame would force a layout flush
 * in the middle of the render loop.
 */

import type { Pointer } from '../core/Pointer'
import type { Quality } from '../core/Quality'

/** Drift of the content layer, in pixels, at full pointer deflection. */
const PARALLAX_X = 26
const PARALLAX_Y = 14
const FADE_MS = 240

export interface Page {
  mount(root: HTMLElement): void
  unmount(): void
  update?(dt: number, pointer: Pointer): void
  readonly panes: HTMLElement[]
}

export class PageHost {
  private active: Page | null = null
  private rects: DOMRect[] = []
  private rectsDirty = true

  constructor(
    private root: HTMLElement,
    private quality: Quality,
  ) {
    addEventListener('resize', this.markDirty, { passive: true })
    addEventListener('scroll', this.markDirty, { passive: true })
  }

  private markDirty = (): void => {
    this.rectsDirty = true
  }

  async show(page: Page): Promise<void> {
    const fade = this.quality.reducedMotion ? 0 : FADE_MS

    if (this.active) {
      this.root.classList.add('is-leaving')
      if (fade) await new Promise((resolve) => setTimeout(resolve, fade))
      this.active.unmount()
      this.root.replaceChildren()
    }

    this.active = page
    page.mount(this.root)
    this.rectsDirty = true

    this.root.classList.remove('is-leaving')
    this.root.classList.add('is-entering')
    // Force a reflow so the entering transition actually runs rather than
    // being collapsed into the same style recalculation.
    void this.root.offsetHeight
    this.root.classList.remove('is-entering')
  }

  update(dt: number, pointer: Pointer): void {
    // Content drifts against the camera's orbit, so it feels attached to the
    // world rather than pasted on top of it.
    const x = -pointer.smooth.x * PARALLAX_X
    const y = pointer.smooth.y * PARALLAX_Y
    this.root.style.setProperty('--parallax-x', `${x.toFixed(2)}px`)
    this.root.style.setProperty('--parallax-y', `${y.toFixed(2)}px`)

    this.active?.update?.(dt, pointer)

    const panes = this.activePanes
    if (this.rectsDirty) {
      this.rects = panes.map((el) => el.getBoundingClientRect())
      this.rectsDirty = false
    }

    const px = (pointer.ndc.x * 0.5 + 0.5) * window.innerWidth
    const py = (-pointer.ndc.y * 0.5 + 0.5) * window.innerHeight

    for (let i = 0; i < panes.length; i++) {
      const rect = this.rects[i]
      const pane = panes[i]
      if (!rect || !pane) continue
      // Skip panes off screen; their sheen is not visible anyway.
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue

      const mx = ((px - rect.left) / rect.width) * 100
      const my = ((py - rect.top) / rect.height) * 100
      pane.style.setProperty('--mx', `${mx.toFixed(1)}%`)
      pane.style.setProperty('--my', `${my.toFixed(1)}%`)
    }
  }

  get activePanes(): HTMLElement[] {
    return this.active?.panes ?? []
  }

  /** 0 at the top of the page, 1 at the bottom. */
  get scrollProgress(): number {
    const max = document.documentElement.scrollHeight - window.innerHeight
    return max <= 0 ? 0 : Math.min(window.scrollY / max, 1)
  }

  dispose(): void {
    removeEventListener('resize', this.markDirty)
    removeEventListener('scroll', this.markDirty)
    this.active?.unmount()
  }
}
