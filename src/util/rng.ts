/**
 * Seeded pseudo-random numbers.
 *
 * The whole world — tree shape, mote seeds, marker jitter — is generated from a
 * seed so that a given build always renders the same scene. Anything that looks
 * random here is reproducible.
 */

/** mulberry32: small, fast, good enough distribution for visual work. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

/** Signed noise in [-spread, spread]. */
export function jitter(rng: () => number, spread: number): number {
  return (rng() * 2 - 1) * spread
}
