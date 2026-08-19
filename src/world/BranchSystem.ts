/**
 * Procedural tree generation.
 *
 * Produces plain typed arrays and nothing else — no materials, no Object3D, no
 * knowledge of how any of it will be drawn. `ScanReveal` turns the line buffers
 * into geometry and `CatBrain` uses the perch list; neither needs to know how
 * the tree was grown.
 *
 * Every vertex carries its distance from the scan origin, which is what lets
 * the reveal shader decide per-fragment whether the wavefront has reached it.
 */

import { Vector3 } from 'three'
import { mulberry32, randRange } from '../util/rng'

export interface BranchData {
  /** Line segment endpoints: 2 vertices, 6 floats per segment. */
  positions: Float32Array
  /** Per-vertex distance from the scan origin. */
  distances: Float32Array
  /** Per-vertex recursion depth, 0 at the trunk. Drives brightness falloff. */
  depths: Float32Array
  /** Billboarded scan markers, one position each. */
  markerOffsets: Float32Array
  markerScales: Float32Array
  markerDistances: Float32Array
  /** Per-marker random value, for desynchronised flicker. */
  markerSeeds: Float32Array
  /** Landing points for the cat: outboard, roughly horizontal, at usable height. */
  perches: Perch[]
  /** Greatest vertex distance from the scan origin — how far the scan must travel. */
  bounds: number
  segmentCount: number
  markerCount: number
}

export interface Perch {
  position: Vector3
  /** Direction the branch runs, normalised. The cat aligns to this. */
  along: Vector3
}

interface PerchCandidate extends Perch {
  depth: number
}

/**
 * Rank branch tips by how good a cat perch they make, then take a well-spread
 * subset. Returns the best available even when nothing meets the ideal, so the
 * cat is never left without a target.
 */
function selectPerches(candidates: PerchCandidate[]): Perch[] {
  const scored = candidates
    .filter(
      (c) =>
        c.position.y > PERCH_MIN_HEIGHT &&
        c.position.y < PERCH_MAX_HEIGHT &&
        Math.hypot(c.position.x, c.position.z) > PERCH_MIN_REACH &&
        Math.abs(c.along.y) < PERCH_MAX_SLOPE,
    )
    .map((c) => {
      const heightScore = 1 - Math.abs(c.position.y - PERCH_IDEAL_HEIGHT) / PERCH_MAX_HEIGHT
      const levelScore = 1 - Math.abs(c.along.y) / PERCH_MAX_SLOPE
      const reachScore = Math.min(Math.hypot(c.position.x, c.position.z) / 7, 1)
      // Mid-depth branches are thick enough to look load-bearing.
      const depthScore = 1 - Math.abs(c.depth - 3) / 6
      return { perch: c, score: heightScore + levelScore * 1.2 + reachScore + depthScore * 0.8 }
    })
    .sort((a, b) => b.score - a.score)

  const chosen: Perch[] = []
  for (const { perch } of scored) {
    if (chosen.length >= PERCH_TARGET_COUNT) break
    if (chosen.every((c) => c.position.distanceTo(perch.position) >= PERCH_SEPARATION)) {
      chosen.push({ position: perch.position, along: perch.along })
    }
  }

  // Last resort: a seed so degenerate that nothing passed the filter. Take the
  // highest tips regardless of angle rather than returning an empty list.
  if (chosen.length === 0) {
    return candidates
      .slice()
      .sort((a, b) => b.position.y - a.position.y)
      .slice(0, PERCH_TARGET_COUNT)
      .map((c) => ({ position: c.position, along: c.along }))
  }

  return chosen
}

export interface BranchOptions {
  seed?: number
  origin?: Vector3
  /** Recursion levels below the trunk. */
  depth?: number
  trunkLength?: number
  /** Length multiplier per level. */
  decay?: number
}

const SUB_SEGMENTS = 5

/**
 * Thick branches are drawn as wireframe tubes — rings plus longitudinal rails —
 * rather than a single line. WebGL cannot draw a line wider than one pixel, so
 * without this the trunk has exactly the same visual weight as a twig, and the
 * tree reads as a flat scribble. Twigs stay single lines; tubing them would
 * multiply the segment count for no visible gain.
 */
const TUBE_MAX_DEPTH = 2
const RING_SEGMENTS = 6
const TUBE_BASE_RADIUS = 0.62
const TUBE_RADIUS_DECAY = 0.54

function tubeRadius(depth: number): number {
  return TUBE_BASE_RADIUS * Math.pow(TUBE_RADIUS_DECAY, depth)
}

/** Perch selection. The cat must always have somewhere to land, so candidates
 * are collected from every branch tip and scored afterwards rather than
 * filtered inline — an inline filter made the count depend on recursion depth
 * and on the seed, and some seeds produced almost none. */
const PERCH_MIN_HEIGHT = 4.0
const PERCH_MAX_HEIGHT = 15.0
const PERCH_MIN_REACH = 2.2
/** Vertical run a branch may have and still be standable. */
const PERCH_MAX_SLOPE = 0.7
/** Heights the cat looks best at — scoring peaks here. */
const PERCH_IDEAL_HEIGHT = 9.0
/** Chosen perches are kept this far apart so leaps read as distinct. */
const PERCH_SEPARATION = 2.5
const PERCH_TARGET_COUNT = 6

interface GrowContext {
  rng: () => number
  origin: Vector3
  positions: number[]
  distances: number[]
  depths: number[]
  markerOffsets: number[]
  markerScales: number[]
  markerDistances: number[]
  markerSeeds: number[]
  candidates: PerchCandidate[]
  maxDepth: number
  decay: number
  bounds: number
}

function pushSegment(ctx: GrowContext, a: Vector3, b: Vector3, depth: number): void {
  pushVertex(ctx, a, depth)
  pushVertex(ctx, b, depth)
}

/** Ring of points around `centre`, in the plane spanned by `normal` x `dir`. */
function ringAt(
  centre: Vector3,
  dir: Vector3,
  normal: Vector3,
  radius: number,
  out: Vector3[],
): Vector3[] {
  const binormal = new Vector3().copy(dir).cross(normal).normalize()
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2
    const point = out[i] ?? new Vector3()
    point
      .copy(centre)
      .addScaledVector(normal, Math.cos(a) * radius)
      .addScaledVector(binormal, Math.sin(a) * radius)
    out[i] = point
  }
  return out
}

function cloneRing(ring: Vector3[]): Vector3[] {
  return ring.map((v) => v.clone())
}

function pushVertex(ctx: GrowContext, p: Vector3, depth: number): void {
  ctx.positions.push(p.x, p.y, p.z)
  const d = p.distanceTo(ctx.origin)
  ctx.distances.push(d)
  ctx.depths.push(depth)
  if (d > ctx.bounds) ctx.bounds = d
}

function pushMarker(ctx: GrowContext, p: Vector3, scale: number): void {
  ctx.markerOffsets.push(p.x, p.y, p.z)
  ctx.markerScales.push(scale)
  ctx.markerDistances.push(p.distanceTo(ctx.origin))
  ctx.markerSeeds.push(ctx.rng())
}

/** An arbitrary unit vector perpendicular to `v`. */
function perpendicular(v: Vector3, out: Vector3): Vector3 {
  // Cross with whichever axis is least aligned, so the result never degenerates.
  const axis = Math.abs(v.y) < 0.9 ? UP : SIDE
  return out.copy(v).cross(axis).normalize()
}

const UP = new Vector3(0, 1, 0)
const SIDE = new Vector3(1, 0, 0)

function grow(
  ctx: GrowContext,
  start: Vector3,
  direction: Vector3,
  length: number,
  depth: number,
): void {
  const dir = direction.clone().normalize()
  const cursor = start.clone()
  const step = length / SUB_SEGMENTS

  // Higher branches droop; the trunk stays upright.
  const droop = depth === 0 ? 0 : 0.05 * depth
  const wander = 0.06 + depth * 0.03

  const axis = new Vector3()
  const next = new Vector3()

  const useTube = depth <= TUBE_MAX_DEPTH
  const radiusStart = tubeRadius(depth)
  const radiusEnd = tubeRadius(depth + 1)

  // Parallel-transported frame. Re-orthogonalising the same normal each step,
  // rather than deriving a fresh one, keeps the tube from twisting as the
  // branch bends.
  const normal = perpendicular(dir, new Vector3())
  let previousRing: Vector3[] | null = useTube
    ? cloneRing(ringAt(cursor, dir, normal, radiusStart, []))
    : null
  const scratchRing: Vector3[] = []

  for (let s = 0; s < SUB_SEGMENTS; s++) {
    perpendicular(dir, axis)
    dir.applyAxisAngle(axis, randRange(ctx.rng, -wander, wander))
    dir.y -= droop * step * 0.12
    dir.normalize()

    next.copy(cursor).addScaledVector(dir, step)

    if (useTube && previousRing) {
      // Remove the component that now lies along the branch, so the frame
      // follows the bend without rolling.
      normal.addScaledVector(dir, -normal.dot(dir)).normalize()
      const radius = radiusStart + (radiusEnd - radiusStart) * ((s + 1) / SUB_SEGMENTS)
      const ring = ringAt(next, dir, normal, radius, scratchRing)

      for (let i = 0; i < RING_SEGMENTS; i++) {
        pushSegment(ctx, previousRing[i]!, ring[i]!, depth)
        pushSegment(ctx, ring[i]!, ring[(i + 1) % RING_SEGMENTS]!, depth)
      }
      previousRing = cloneRing(ring)

      if (ctx.rng() < 0.55) {
        pushMarker(ctx, ring[Math.floor(ctx.rng() * RING_SEGMENTS)]!, randRange(ctx.rng, 0.07, 0.15))
      }
    } else {
      pushSegment(ctx, cursor, next, depth)

      // Markers thin out toward the twigs so the canopy does not turn to soup.
      if (ctx.rng() < 0.5 - depth * 0.05) {
        pushMarker(ctx, next, randRange(ctx.rng, 0.055, 0.14) * Math.max(0.35, 1 - depth * 0.11))
      }
    }

    cursor.copy(next)
  }

  const tip = cursor.clone()

  ctx.candidates.push({ position: tip.clone(), along: dir.clone(), depth })

  if (depth >= ctx.maxDepth) {
    // Tip marker, slightly larger — these read as the scan's "points of interest".
    pushMarker(ctx, tip, randRange(ctx.rng, 0.09, 0.16))
    return
  }

  const children = ctx.rng() < 0.28 ? 3 : 2
  const spread = 0.42 + depth * 0.055
  const roll = randRange(ctx.rng, 0, Math.PI * 2)

  for (let c = 0; c < children; c++) {
    const childDir = dir.clone()
    perpendicular(childDir, axis)

    // Fan the children around the parent, then tilt each away from the axis.
    childDir.applyAxisAngle(dir, roll + (c / children) * Math.PI * 2)
    perpendicular(childDir, axis)
    childDir
      .copy(dir)
      .applyAxisAngle(axis, randRange(ctx.rng, spread * 0.55, spread * 1.45))
      .applyAxisAngle(dir, roll + (c / children) * Math.PI * 2 + randRange(ctx.rng, -0.3, 0.3))

    // Keep some upward intent so the silhouette stays a tree, not a bush.
    childDir.y += 0.22
    childDir.normalize()

    grow(ctx, tip, childDir, length * ctx.decay * randRange(ctx.rng, 0.86, 1.12), depth + 1)
  }
}

export function generateBranches(options: BranchOptions = {}): BranchData {
  const {
    seed = 20260819,
    origin = new Vector3(0, 6.5, 0),
    depth = 6,
    trunkLength = 5.6,
    decay = 0.755,
  } = options

  const ctx: GrowContext = {
    rng: mulberry32(seed),
    origin,
    positions: [],
    distances: [],
    depths: [],
    markerOffsets: [],
    markerScales: [],
    markerDistances: [],
    markerSeeds: [],
    candidates: [],
    maxDepth: depth,
    decay,
    bounds: 0,
  }

  // Two trunks from a shared base gives an asymmetric silhouette that reads far
  // better in a wireframe than a single symmetric fork.
  grow(ctx, new Vector3(0, -2.4, 0), new Vector3(0.06, 1, 0.03), trunkLength, 0)
  grow(ctx, new Vector3(0, -1.2, 0), new Vector3(-0.34, 1, -0.16), trunkLength * 0.72, 1)

  return {
    positions: new Float32Array(ctx.positions),
    distances: new Float32Array(ctx.distances),
    depths: new Float32Array(ctx.depths),
    markerOffsets: new Float32Array(ctx.markerOffsets),
    markerScales: new Float32Array(ctx.markerScales),
    markerDistances: new Float32Array(ctx.markerDistances),
    markerSeeds: new Float32Array(ctx.markerSeeds),
    perches: selectPerches(ctx.candidates),
    bounds: ctx.bounds,
    segmentCount: ctx.positions.length / 6,
    markerCount: ctx.markerScales.length,
  }
}
