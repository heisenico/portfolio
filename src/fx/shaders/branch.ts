/**
 * Branch wireframe with a distance-driven scan reveal.
 *
 * Each vertex knows how far it sits from the scan origin. The fragment shader
 * compares that against the wavefront radius, which gives three zones at once:
 * unreached (discarded), the bright leading band, and the dim settled wireframe
 * behind it. That single comparison is the whole Death Stranding read.
 */

export const branchVertex = /* glsl */ `
attribute float aDist;
attribute float aDepth;
attribute float aBranchId;

varying float vDist;
varying float vDepth;
varying float vBranchId;

#include <fog_pars_vertex>

void main() {
  vDist = aDist;
  vDepth = aDepth;
  vBranchId = aBranchId;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`

export const branchFragment = /* glsl */ `
uniform float uScanRadius;
uniform float uBand;
uniform float uRest;
uniform float uMaxDepth;
uniform float uTime;
uniform vec3 uRestColor;
uniform vec3 uEdgeColor;
uniform float uOpacity;
uniform float uGain;
uniform float uHotGain;
uniform float uLitBranch;

varying float vDist;
varying float vDepth;
varying float vBranchId;

#include <fog_pars_fragment>

void main() {
  float lead = uScanRadius - vDist;

  // Nothing beyond the wavefront exists yet.
  if (lead < 0.0) discard;

  // 1 at the wavefront, falling to 0 over uBand behind it.
  float wave = 1.0 - smoothstep(0.0, uBand, lead);

  // Thinner branches read as further from the trunk, so dim them.
  float depthFade = mix(1.0, 0.62, clamp(vDepth / uMaxDepth, 0.0, 1.0));

  // A slow travelling ripple keeps the settled wireframe from looking static.
  float ripple = sin(vDist * 6.0 - uTime * 2.4) * 0.5 + 0.5;

  // The settled wireframe and the wavefront are two separate terms, summed —
  // not a mix between them. A mix caps the crest at the same brightness as the
  // rest state, which is why the wavefront failed to read as a wavefront.
  float rest = uRest * (0.82 + ripple * 0.18) * depthFade;
  float crest = pow(wave, 2.2) * uHotGain * depthFade;

  // One branch can be singled out — this is how a blog post says "that's me".
  // Compared with a tolerance because the id travels as a float varying.
  if (uLitBranch >= 0.0 && abs(vBranchId - uLitBranch) < 0.5) {
    crest += 0.9;
  }

  vec3 color = uRestColor * rest + uEdgeColor * crest;
  float alpha = clamp(rest + crest, 0.0, 1.0) * uOpacity;

  gl_FragColor = vec4(color * uGain, alpha);

  #include <fog_fragment>
}
`
