/**
 * Cursor trail particles.
 *
 * Life is passed per particle rather than shared, so a burst does not all
 * expire on the same frame. Dead particles are collapsed off-screen in the
 * vertex shader instead of being compacted out of the buffer.
 */

export const trailVertex = /* glsl */ `
attribute float aAge;
attribute float aLife;
attribute float aSeed;

uniform float uSize;
uniform float uDpr;

varying float vLife;
varying float vSeed;

void main() {
  float t = aAge / aLife;

  if (t >= 1.0) {
    // Off-screen and zero-sized: cheaper than restructuring the buffer.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  vLife = t;
  vSeed = aSeed;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Shrink over life, with a brief flare at birth.
  float grow = smoothstep(0.0, 0.08, t);
  float shrink = 1.0 - smoothstep(0.25, 1.0, t);
  gl_PointSize = uSize * uDpr * grow * shrink * (14.0 / -mvPosition.z);
}
`

export const trailFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uOpacity;

varying float vLife;
varying float vSeed;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p);
  if (r > 0.5) discard;

  float core = pow(1.0 - smoothstep(0.0, 0.5, r), 2.0);

  // White at birth, cooling to the scan colour as it dies.
  vec3 color = mix(uHot, uColor, smoothstep(0.0, 0.35, vLife));

  float alpha = core * (1.0 - vLife) * uOpacity;
  if (alpha < 0.003) discard;

  gl_FragColor = vec4(color * alpha * 1.6, alpha);
}
`
