/**
 * Performance budgeting.
 *
 * Two-stage, because a frame-time probe cannot answer a question that has to be
 * answered before the first frame exists:
 *
 *  1. At construction, a synchronous estimate from device hints picks the
 *     initial tier. Every system sizes its buffers from this.
 *  2. Over the first frames, measured frame time can *downgrade* the running
 *     quality. A downgrade never reallocates: it lowers the DPR cap and reduces
 *     `activeFraction`, which particle systems apply with `setDrawRange`.
 *
 * Downgrades are one-way. A machine that stutters early and recovers keeps the
 * cheaper settings rather than oscillating between them.
 */

export type Tier = 'high' | 'moderate' | 'low'

export interface Budget {
  readonly dprCap: number
  readonly motes: number
  readonly trail: number
  readonly bloomScale: number
  readonly grain: boolean
}

const BUDGETS: Record<Tier, Budget> = {
  high: { dprCap: 2, motes: 3000, trail: 600, bloomScale: 0.5, grain: true },
  moderate: { dprCap: 1.5, motes: 1500, trail: 300, bloomScale: 0.35, grain: true },
  low: { dprCap: 1, motes: 700, trail: 150, bloomScale: 0.25, grain: false },
}

const TIER_ORDER: Tier[] = ['high', 'moderate', 'low']

/** Samples collected before the measured tier is trusted. */
export const SAMPLE_COUNT = 30
/** Leading samples ignored — shader compilation and texture upload land here. */
export const WARMUP_SAMPLES = 5
/**
 * Frames longer than this are stalls, not capability: a tab switch, a GC pause,
 * a debugger break. Counting them would strand a fast machine on the low tier
 * for the rest of the session, since downgrades are one-way.
 */
export const STALL_MS = 200

/** Mean frame time in ms below which each tier is claimed. */
export const HIGH_MAX_MS = 20
export const MODERATE_MAX_MS = 34

export function tierFromFrameMs(meanMs: number): Tier {
  if (meanMs < HIGH_MAX_MS) return 'high'
  if (meanMs < MODERATE_MAX_MS) return 'moderate'
  return 'low'
}

export interface DeviceHints {
  cores?: number | undefined
  memoryGb?: number | undefined
  mobile?: boolean | undefined
  /** Longest viewport edge in CSS pixels, times device pixel ratio. */
  pixels?: number | undefined
}

/** Initial tier guess, made before a single frame has been drawn. */
export function tierFromHints(h: DeviceHints): Tier {
  const cores = h.cores ?? 8
  const memory = h.memoryGb ?? 8
  const pixels = h.pixels ?? 2_000_000

  if (h.mobile) return cores >= 8 && memory >= 6 ? 'moderate' : 'low'
  if (cores <= 4 || memory <= 4) return 'low'
  // A 5K display costs more than twice a 1440p one at the same DPR cap.
  if (pixels > 8_000_000 && cores < 10) return 'moderate'
  if (cores <= 6) return 'moderate'
  return 'high'
}

function readHints(): DeviceHints {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return {}
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    cores: nav.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    mobile: window.matchMedia('(pointer: coarse)').matches,
    pixels:
      Math.max(window.innerWidth, window.innerHeight) *
      Math.min(window.innerWidth, window.innerHeight) *
      Math.min(window.devicePixelRatio || 1, 2),
  }
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export class Quality {
  /** The tier every buffer was sized for. Never changes after construction. */
  readonly initialTier: Tier
  readonly reducedMotion: boolean

  private samples: number[] = []
  private runningTier: Tier
  private listeners: ((q: Quality) => void)[] = []

  constructor(hints: DeviceHints = readHints(), reducedMotion: boolean = readReducedMotion()) {
    this.initialTier = tierFromHints(hints)
    this.runningTier = this.initialTier
    this.reducedMotion = reducedMotion
  }

  /** Feed one frame's duration in milliseconds. Stalls are discarded. */
  sample(frameMs: number): void {
    if (this.settled) return
    if (frameMs > STALL_MS || !Number.isFinite(frameMs)) {
      this.stalls++
      return
    }
    this.samples.push(frameMs)
    if (this.samples.length === SAMPLE_COUNT) this.resolve()
  }

  /** Frames discarded as stalls. Surfaced for diagnostics only. */
  stalls = 0

  private resolve(): void {
    const useful = this.samples.slice(WARMUP_SAMPLES)
    const mean = useful.reduce((a, b) => a + b, 0) / useful.length
    const measured = tierFromFrameMs(mean)

    // Downgrade only. Buffers are already sized; claiming a better tier now
    // would promise particles that were never allocated.
    if (TIER_ORDER.indexOf(measured) > TIER_ORDER.indexOf(this.runningTier)) {
      this.runningTier = measured
      for (const fn of this.listeners) fn(this)
    }
  }

  get settled(): boolean {
    return this.samples.length >= SAMPLE_COUNT
  }

  get tier(): Tier {
    return this.runningTier
  }

  /** Fired once if the measured tier turns out worse than the estimate. */
  onDowngrade(fn: (q: Quality) => void): void {
    this.listeners.push(fn)
  }

  /**
   * Portion of each particle buffer that should actually be drawn. Buffers are
   * allocated at `initialTier`; a downgrade shrinks the draw range instead of
   * reallocating mid-flight.
   */
  get activeFraction(): number {
    return BUDGETS[this.runningTier].motes / BUDGETS[this.initialTier].motes
  }

  /** Allocation sizes — read these once, at construction. */
  get allocation(): Budget {
    return BUDGETS[this.initialTier]
  }

  get dprCap(): number {
    return BUDGETS[this.runningTier].dprCap
  }

  get bloomScale(): number {
    return BUDGETS[this.runningTier].bloomScale
  }

  get grain(): boolean {
    return BUDGETS[this.runningTier].grain && !this.reducedMotion
  }
}
