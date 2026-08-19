/**
 * Ground grid: same distance-gated reveal as the branches, plus a radial fade
 * so the grid dissolves before it reaches its own edge. Without that fade the
 * outermost ring reads as a hard boundary and the space stops feeling open.
 */

export const groundVertex = /* glsl */ `
attribute float aDist;
attribute float aRadius;

varying float vDist;
varying float vRadius;

#include <fog_pars_vertex>

void main() {
  vDist = aDist;
  vRadius = aRadius;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`

export const groundFragment = /* glsl */ `
uniform float uScanRadius;
uniform float uBand;
uniform float uTime;
uniform float uFadeRadius;
uniform float uOpacity;
uniform vec3 uColor;

varying float vDist;
varying float vRadius;

#include <fog_pars_fragment>

void main() {
  float lead = uScanRadius - vDist;
  if (lead < 0.0) discard;

  float wave = 1.0 - smoothstep(0.0, uBand, lead);

  // Dissolve outward so the grid has no visible edge. The ramp starts close in
  // and is squared, because a late or linear fade leaves the outermost ring
  // legible as a hard arc that reads like the rim of a dome.
  float radial = 1.0 - smoothstep(uFadeRadius * 0.12, uFadeRadius, vRadius);
  radial *= radial;

  // A slow outward breath, so the floor feels alive rather than printed on.
  float breath = sin(vRadius * 0.55 - uTime * 0.8) * 0.5 + 0.5;

  float rest = 0.2 * radial * (0.55 + breath * 0.45);
  float crest = pow(wave, 2.0) * 1.1 * radial;

  float alpha = clamp(rest + crest, 0.0, 1.0) * uOpacity;
  if (alpha < 0.003) discard;

  gl_FragColor = vec4(uColor * (rest + crest) * 1.5, alpha);

  #include <fog_fragment>
}
`
