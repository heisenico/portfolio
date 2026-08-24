import { describe, expect, it, vi } from 'vitest'
import {
  HIGH_MAX_MS,
  MODERATE_MAX_MS,
  Quality,
  SAMPLE_COUNT,
  STALL_MS,
  tierFromFrameMs,
  tierFromHints,
} from '../Quality'

const desktop = { cores: 12, memoryGb: 16, mobile: false, pixels: 3_000_000 }

function feed(q: Quality, frameMs: number, count = SAMPLE_COUNT): void {
  for (let i = 0; i < count; i++) q.sample(frameMs)
}

describe('tierFromFrameMs', () => {
  it('maps each band to its tier', () => {
    expect(tierFromFrameMs(8)).toBe('high')
    expect(tierFromFrameMs(HIGH_MAX_MS - 0.01)).toBe('high')
    expect(tierFromFrameMs(HIGH_MAX_MS)).toBe('moderate')
    expect(tierFromFrameMs(MODERATE_MAX_MS - 0.01)).toBe('moderate')
    expect(tierFromFrameMs(MODERATE_MAX_MS)).toBe('low')
    expect(tierFromFrameMs(120)).toBe('low')
  })
})

describe('tierFromHints', () => {
  it('gives a capable desktop the top tier', () => {
    expect(tierFromHints(desktop)).toBe('high')
  })

  it('never gives a phone the top tier', () => {
    expect(tierFromHints({ ...desktop, mobile: true })).toBe('moderate')
    expect(tierFromHints({ cores: 4, memoryGb: 4, mobile: true })).toBe('low')
  })

  it('drops thin machines to low', () => {
    expect(tierFromHints({ cores: 4, memoryGb: 16 })).toBe('low')
    expect(tierFromHints({ cores: 12, memoryGb: 4 })).toBe('low')
  })

  it('steps a huge display down when the CPU is mid-range', () => {
    expect(tierFromHints({ cores: 8, memoryGb: 16, pixels: 14_000_000 })).toBe('moderate')
  })

  it('falls back to a sane default when nothing is known', () => {
    expect(tierFromHints({})).toBe('high')
  })
})

describe('Quality', () => {
  it('is unsettled until it has enough samples', () => {
    const q = new Quality(desktop, false)
    feed(q, 10, SAMPLE_COUNT - 1)
    expect(q.settled).toBe(false)
    q.sample(10)
    expect(q.settled).toBe(true)
  })

  it('keeps the estimated tier when frames are fast', () => {
    const q = new Quality(desktop, false)
    feed(q, 10)
    expect(q.tier).toBe('high')
    expect(q.activeFraction).toBe(1)
  })

  it('downgrades when frames are slow', () => {
    const q = new Quality(desktop, false)
    feed(q, 50)
    expect(q.tier).toBe('low')
    expect(q.dprCap).toBe(1)
    expect(q.grain).toBe(false)
  })

  it('downgrades one step for middling frames', () => {
    const q = new Quality(desktop, false)
    feed(q, 25)
    expect(q.tier).toBe('moderate')
  })

  it('never upgrades past the tier its buffers were sized for', () => {
    const q = new Quality({ cores: 4, memoryGb: 4 }, false)
    expect(q.initialTier).toBe('low')
    feed(q, 4)
    expect(q.tier).toBe('low')
  })

  it('shrinks the draw range instead of reallocating on downgrade', () => {
    const q = new Quality(desktop, false)
    const allocated = q.allocation.motes
    feed(q, 50)
    expect(q.allocation.motes).toBe(allocated)
    expect(q.activeFraction).toBeLessThan(1)
    expect(Math.round(allocated * q.activeFraction)).toBe(700)
  })

  it('ignores warm-up samples when averaging', () => {
    const q = new Quality(desktop, false)
    // Five catastrophic compile frames followed by a comfortably fast run.
    for (let i = 0; i < 5; i++) q.sample(400)
    feed(q, 8, SAMPLE_COUNT - 5)
    expect(q.tier).toBe('high')
  })

  it('fires the downgrade listener exactly once', () => {
    const q = new Quality(desktop, false)
    const spy = vi.fn()
    q.onDowngrade(spy)
    feed(q, 50)
    feed(q, 50)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('discards stall frames instead of letting them force a downgrade', () => {
    const q = new Quality(desktop, false)
    // A tab switch mid-probe: a few multi-second frames among fast ones.
    q.sample(STALL_MS + 3000)
    feed(q, 9, 10)
    q.sample(STALL_MS + 500)
    feed(q, 9, SAMPLE_COUNT - 10)
    expect(q.stalls).toBe(2)
    expect(q.tier).toBe('high')
  })

  it('ignores non-finite frame times', () => {
    const q = new Quality(desktop, false)
    q.sample(Number.NaN)
    q.sample(Number.POSITIVE_INFINITY)
    expect(q.stalls).toBe(2)
    expect(q.settled).toBe(false)
  })

  it('forces grain off under reduced motion regardless of tier', () => {
    const q = new Quality(desktop, true)
    expect(q.tier).toBe('high')
    expect(q.grain).toBe(false)
    expect(q.reducedMotion).toBe(true)
  })
})

describe('Quality.tema', () => {
  it('fora do browser é papel', () => {
    // O terceiro parâmetro não é passado: o default lê matchMedia, que não
    // existe no ambiente node do vitest.
    expect(new Quality(desktop, false).tema).toBe('papel')
  })

  it('aceita o tema injetado', () => {
    expect(new Quality(desktop, false, 'noite').tema).toBe('noite')
  })

  it('avisa quem escuta quando o tema muda, com o valor novo', () => {
    const q = new Quality(desktop, false, 'papel')
    const spy = vi.fn()
    q.onTema(spy)
    q.setTema('noite')
    expect(q.tema).toBe('noite')
    expect(spy).toHaveBeenCalledWith('noite')
  })

  it('não avisa quando o tema é o mesmo', () => {
    const q = new Quality(desktop, false, 'papel')
    const spy = vi.fn()
    q.onTema(spy)
    q.setTema('papel')
    expect(spy).not.toHaveBeenCalled()
  })
})
