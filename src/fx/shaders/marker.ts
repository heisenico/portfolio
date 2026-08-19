/**
 * Scan markers: small camera-facing diamonds that pop in as the wavefront
 * crosses them, overshoot, and settle to a dim persistent glyph.
 *
 * Billboarding is done in the vertex shader from the view matrix basis, so the
 * whole layer is one instanced draw call with no per-frame CPU work.
 */

export const markerVertex = /* glsl */ `
attribute vec3 aOffset;
attribute float aScale;
attribute float aDist;
attribute float aSeed;

uniform float uScanRadius;
uniform float uPopDistance;
uniform float uSettleDistance;
uniform float uTime;

varying float vLead;
varying float vSeed;
varying vec2 vUv;

// easeOutBack — overshoots past 1 before settling, which is what makes the
// markers feel like they snap into place rather than fade up.
float easeOutBack(float t) {
  const float c1 = 1.70158;
  const float c3 = c1 + 1.0;
  float p = t - 1.0;
  return 1.0 + c3 * p * p * p + c1 * p * p;
}

void main() {
  vUv = uv;
  vSeed = aSeed;

  float lead = uScanRadius - aDist;
  vLead = lead;

  if (lead < 0.0) {
    // Collapse to a point behind the camera rather than discarding per-fragment.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  float pop = easeOutBack(clamp(lead / uPopDistance, 0.0, 1.0));

  // Once settled, breathe very slightly, desynchronised per marker.
  float breathe = 1.0 + sin(uTime * 1.6 + aSeed * 40.0) * 0.06;
  float size = aScale * pop * breathe;

  // Billboard from the view matrix basis vectors.
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

  vec3 worldPos = aOffset + (camRight * position.x + camUp * position.y) * size;

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
`

export const markerFragment = /* glsl */ `
uniform float uSettleDistance;
uniform float uRestAlpha;
uniform float uTime;
uniform vec3 uRestColor;
uniform vec3 uEdgeColor;
uniform float uOpacity;

varying float vLead;
varying float vSeed;
varying vec2 vUv;

void main() {
  // Diamond outline: |x| + |y| in centred coordinates gives the shape, and the
  // difference of two smoothsteps hollows it out.
  vec2 p = vUv - 0.5;
  float d = abs(p.x) + abs(p.y);

  float outer = 1.0 - smoothstep(0.34, 0.42, d);
  float inner = 1.0 - smoothstep(0.18, 0.26, d);
  float ring = clamp(outer - inner, 0.0, 1.0);

  if (ring < 0.01) discard;

  // Bright while the wavefront is on it, dim once it has passed.
  float settled = smoothstep(0.0, uSettleDistance, vLead);
  float alpha = mix(1.0, uRestAlpha, settled);

  // A rare flicker keeps the settled field alive without being busy.
  float flicker = step(0.986, fract(sin(vSeed * 91.7 + floor(uTime * 3.0) * 0.61) * 43758.5453));
  alpha += flicker * 0.5 * settled;

  vec3 color = mix(uEdgeColor, uRestColor, settled);

  gl_FragColor = vec4(color * alpha, ring * alpha * uOpacity);
}
`
