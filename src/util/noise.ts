/**
 * Simplex noise and curl noise, with GLSL twins.
 *
 * The CPU implementations drive the pointer trail and the cat's idle sway. The
 * GLSL sources drive the mote field, where per-particle work has to happen on
 * the GPU. Both sides use the same algorithm so the two layers of the world
 * drift with the same character.
 *
 * Simplex noise algorithm after Stefan Gustavson's public-domain reference
 * implementation; the GLSL variant is Ashima Arts' `snoise` (MIT).
 */

import type { Vector3 } from 'three'
import { mulberry32 } from './rng'

const GRAD3 = new Int8Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1,
  1, 0, 1, -1, 0, -1, -1,
])

// A fixed permutation table, shuffled from a fixed seed so the field never
// changes between builds.
const PERM = new Uint8Array(512)
const PERM_MOD_12 = new Uint8Array(512)
{
  const base = new Uint8Array(256)
  for (let i = 0; i < 256; i++) base[i] = i
  const rng = mulberry32(0x5eed)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = base[i]!
    base[i] = base[j]!
    base[j] = tmp
  }
  for (let i = 0; i < 512; i++) {
    PERM[i] = base[i & 255]!
    PERM_MOD_12[i] = PERM[i]! % 12
  }
}

const F3 = 1 / 3
const G3 = 1 / 6

function dot3(gi: number, x: number, y: number, z: number): number {
  const i = gi * 3
  return GRAD3[i]! * x + GRAD3[i + 1]! * y + GRAD3[i + 2]! * z
}

/** 3D simplex noise, output roughly in [-1, 1]. */
export function simplex3(x: number, y: number, z: number): number {
  const s = (x + y + z) * F3
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)
  const k = Math.floor(z + s)
  const t = (i + j + k) * G3

  const x0 = x - (i - t)
  const y0 = y - (j - t)
  const z0 = z - (k - t)

  let i1: number, j1: number, k1: number
  let i2: number, j2: number, k2: number
  if (x0 >= y0) {
    if (y0 >= z0) {
      i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0
    } else if (x0 >= z0) {
      i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1
    } else {
      i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1
    }
  } else {
    if (y0 < z0) {
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1
    } else if (x0 < z0) {
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1
    } else {
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0
    }
  }

  const x1 = x0 - i1 + G3
  const y1 = y0 - j1 + G3
  const z1 = z0 - k1 + G3
  const x2 = x0 - i2 + 2 * G3
  const y2 = y0 - j2 + 2 * G3
  const z2 = z0 - k2 + 2 * G3
  const x3 = x0 - 1 + 3 * G3
  const y3 = y0 - 1 + 3 * G3
  const z3 = z0 - 1 + 3 * G3

  const ii = i & 255
  const jj = j & 255
  const kk = k & 255

  let n = 0

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
  if (t0 > 0) {
    t0 *= t0
    n += t0 * t0 * dot3(PERM_MOD_12[ii + PERM[jj + PERM[kk]!]!]!, x0, y0, z0)
  }
  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
  if (t1 > 0) {
    t1 *= t1
    n += t1 * t1 * dot3(PERM_MOD_12[ii + i1 + PERM[jj + j1 + PERM[kk + k1]!]!]!, x1, y1, z1)
  }
  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
  if (t2 > 0) {
    t2 *= t2
    n += t2 * t2 * dot3(PERM_MOD_12[ii + i2 + PERM[jj + j2 + PERM[kk + k2]!]!]!, x2, y2, z2)
  }
  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
  if (t3 > 0) {
    t3 *= t3
    n += t3 * t3 * dot3(PERM_MOD_12[ii + 1 + PERM[jj + 1 + PERM[kk + 1]!]!]!, x3, y3, z3)
  }

  return 32 * n
}

/** Fractal Brownian motion over `simplex3`. */
export function fbm3(x: number, y: number, z: number, octaves = 3): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * simplex3(x * freq, y * freq, z * freq)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/** Finite-difference step used by `curl3`. Exported so tests can measure the
 * discrete field's divergence at the step the field itself is built on. */
export const CURL_EPS = 1e-2
// Offsets decorrelate the three scalar potentials so the field does not collapse
// onto a plane.
const OFF_1 = 31.416
const OFF_2 = 47.853

/**
 * Curl of a noise potential field: divergence-free, so particles advected by it
 * swirl without ever piling up or thinning out.
 */
export function curl3(x: number, y: number, z: number, out: Vector3): Vector3 {
  const e = CURL_EPS
  const inv = 1 / (2 * e)

  // psi1 = n(p), psi2 = n(p + OFF_1), psi3 = n(p + OFF_2)
  const p1y0 = simplex3(x, y - e, z)
  const p1y1 = simplex3(x, y + e, z)
  const p1z0 = simplex3(x, y, z - e)
  const p1z1 = simplex3(x, y, z + e)

  const ox = x + OFF_1
  const oy = y + OFF_1
  const oz = z + OFF_1
  const p2x0 = simplex3(ox - e, oy, oz)
  const p2x1 = simplex3(ox + e, oy, oz)
  const p2z0 = simplex3(ox, oy, oz - e)
  const p2z1 = simplex3(ox, oy, oz + e)

  const qx = x + OFF_2
  const qy = y + OFF_2
  const qz = z + OFF_2
  const p3x0 = simplex3(qx - e, qy, qz)
  const p3x1 = simplex3(qx + e, qy, qz)
  const p3y0 = simplex3(qx, qy - e, qz)
  const p3y1 = simplex3(qx, qy + e, qz)

  out.set(
    (p3y1 - p3y0) * inv - (p2z1 - p2z0) * inv,
    (p1z1 - p1z0) * inv - (p3x1 - p3x0) * inv,
    (p2x1 - p2x0) * inv - (p1y1 - p1y0) * inv,
  )
  return out
}

/** Ashima Arts 3D simplex noise (MIT) — the GPU twin of `simplex3`. */
export const GLSL_SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

/** Curl of the simplex potential field. Requires GLSL_SIMPLEX to be included first. */
export const GLSL_CURL = /* glsl */ `
vec3 curlNoise(vec3 p) {
  const float e = 0.08;
  const float o1 = 31.416;
  const float o2 = 47.853;
  float inv = 1.0 / (2.0 * e);

  float p1y1 = snoise(p + vec3(0.0, e, 0.0));
  float p1y0 = snoise(p - vec3(0.0, e, 0.0));
  float p1z1 = snoise(p + vec3(0.0, 0.0, e));
  float p1z0 = snoise(p - vec3(0.0, 0.0, e));

  vec3 q = p + o1;
  float p2x1 = snoise(q + vec3(e, 0.0, 0.0));
  float p2x0 = snoise(q - vec3(e, 0.0, 0.0));
  float p2z1 = snoise(q + vec3(0.0, 0.0, e));
  float p2z0 = snoise(q - vec3(0.0, 0.0, e));

  vec3 r = p + o2;
  float p3x1 = snoise(r + vec3(e, 0.0, 0.0));
  float p3x0 = snoise(r - vec3(e, 0.0, 0.0));
  float p3y1 = snoise(r + vec3(0.0, e, 0.0));
  float p3y0 = snoise(r - vec3(0.0, e, 0.0));

  return vec3(
    (p3y1 - p3y0) * inv - (p2z1 - p2z0) * inv,
    (p1z1 - p1z0) * inv - (p3x1 - p3x0) * inv,
    (p2x1 - p2x0) * inv - (p1y1 - p1y0) * inv
  );
}
`
