/**
 * Ambient motes.
 *
 * All motion happens in the vertex shader, driven by time and a per-particle
 * seed, so several thousand particles cost nothing on the CPU. Each mote
 * wobbles inside a bounded neighbourhood of its base position — advecting them
 * by integrating a velocity would need per-frame state and would slowly drain
 * the volume, since particles that wander out never come back.
 */

import { GLSL_CURL, GLSL_SIMPLEX } from '../../util/noise'

export const motesVertex = /* glsl */ `
attribute vec3 aBase;
attribute float aSeed;
attribute float aScale;

uniform float uTime;
uniform float uSize;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uPointerRadius;
uniform float uRevealRadius;
uniform vec3 uScanOrigin;
uniform float uRiseHeight;
uniform float uSwirl;
uniform float uDpr;

varying float vSeed;
varying float vFade;

${GLSL_SIMPLEX}
${GLSL_CURL}

void main() {
  vec3 pos = aBase;

  // Slow rise, wrapped: motes drift up and reappear at the bottom, which reads
  // as a living volume without any particle ever leaving the field.
  float rise = mod(uTime * (0.16 + aSeed * 0.22) + aSeed * uRiseHeight, uRiseHeight);
  pos.y += rise - uRiseHeight * 0.5;

  // Bounded swirl. Sampling curl at a slowly moving point keeps the offset
  // inside a fixed radius instead of integrating away.
  vec3 swirl = curlNoise(pos * 0.09 + vec3(0.0, uTime * 0.045, 0.0));
  pos += swirl * uSwirl;

  // Pointer pushes motes aside with an inverse-square falloff.
  vec3 away = pos - uPointer;
  float d = length(away);
  float push = uPointerStrength / (1.0 + pow(d / uPointerRadius, 2.0));
  pos += normalize(away + 1e-5) * min(push, uPointerRadius * 0.8);

  // Fade in behind the wavefront so the motes belong to the reveal.
  //
  // Gated on a reveal radius sized to the mote field, not the scan radius:
  // the field is far larger than the tree, so reusing the tree's scan radius
  // left every outer mote permanently hidden.
  float lead = uRevealRadius - distance(pos, uScanOrigin);
  vFade = smoothstep(0.0, 3.0, lead);
  vSeed = aSeed;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Perspective size attenuation, scaled by device pixel ratio so motes are
  // the same physical size on any display.
  gl_PointSize = uSize * aScale * uDpr * (14.0 / -mvPosition.z);
}
`

export const motesFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;

varying float vSeed;
varying float vFade;

void main() {
  // Soft round sprite from the point coordinate.
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p);
  if (r > 0.5) discard;

  float core = 1.0 - smoothstep(0.0, 0.5, r);
  core = pow(core, 2.4);

  // Each mote breathes on its own phase.
  float pulse = 0.62 + 0.38 * sin(uTime * 0.9 + vSeed * 62.8);

  float alpha = core * pulse * vFade * uOpacity;
  if (alpha < 0.002) discard;

  gl_FragColor = vec4(uColor * alpha, alpha);
}
`
