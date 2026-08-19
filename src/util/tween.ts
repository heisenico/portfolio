/**
 * Interpolation, easing, and a minimal cue timeline.
 *
 * Deliberately not a tween library: every animation in this project is driven by
 * a subsystem that already owns its own time, so all that is needed is a set of
 * pure curves plus one scheduler for the intro.
 */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Inverse of `lerp`. Returns 0 for a degenerate range rather than NaN. */
export function invLerp(a: number, b: number, v: number): number {
  return b === a ? 0 : (v - a) / (b - a)
}

/**
 * Frame-rate independent exponential smoothing.
 *
 * The naive `current += (target - current) * 0.1` moves faster on a 144Hz
 * display than on a 60Hz one. This does not: the decay is expressed per second.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt)
}

export function easeInQuad(t: number): number {
  return t * t
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5)
}

/** Overshoots past 1 and settles back — used for markers popping in. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Springy settle — used for the cat's landing. */
export function easeOutElastic(t: number): number {
  if (t === 0) return 0
  if (t === 1) return 1
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

/** Rises to 1 at the midpoint and falls back to 0 — a one-shot pulse envelope. */
export function arch(t: number): number {
  return Math.sin(clamp01(t) * Math.PI)
}

interface Cue {
  time: number
  fn: () => void
  fired: boolean
}

/**
 * Fires one-shot callbacks as elapsed time passes their mark.
 *
 * Cues never fire twice, always fire in chronological order even if several fall
 * inside a single frame, and `skipToEnd` flushes the rest so the intro can be
 * cut short without leaving systems half-initialised.
 */
export class Timeline {
  private cues: Cue[] = []
  private elapsed = 0

  at(time: number, fn: () => void): this {
    this.cues.push({ time, fn, fired: false })
    this.cues.sort((a, b) => a.time - b.time)
    return this
  }

  update(dt: number): void {
    this.elapsed += dt
    for (const cue of this.cues) {
      if (!cue.fired && this.elapsed >= cue.time) {
        cue.fired = true
        cue.fn()
      }
    }
  }

  skipToEnd(): void {
    const last = this.cues[this.cues.length - 1]
    this.elapsed = Math.max(this.elapsed, last ? last.time : 0)
    for (const cue of this.cues) {
      if (!cue.fired) {
        cue.fired = true
        cue.fn()
      }
    }
  }

  get done(): boolean {
    return this.cues.every((c) => c.fired)
  }

  get time(): number {
    return this.elapsed
  }
}
