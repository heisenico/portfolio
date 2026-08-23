/**
 * Twig wireframe with a distance-driven scan reveal, gated a second way.
 *
 * A deliberate copy of the `branch.ts` pair, not a parameterisation of it. The
 * tree's shader runs over roughly forty thousand vertices every frame and is
 * the single hottest program in the scene; adding a branch to that inner loop
 * so a handful of twigs could pick a second gating mode would tax it for the
 * rest of the site's life. Two readable programs beat one clever one here.
 *
 * The extra gate is `aTwigIndex`: a generated post world lights one twig per
 * paragraph read, so growth has to be driven by `uLit` — how far the reader
 * has scrolled — rather than by `uScanRadius`, which only knows distance from
 * the scan origin. Everything else, including the wavefront look itself,
 * stays identical to `branch.ts` on purpose.
 */

export const twigVertex = /* glsl */ `
attribute float aDist;
attribute float aDepth;
attribute float aBranchId;
attribute float aTwigIndex;

varying float vDist;
varying float vDepth;
varying float vBranchId;
varying float vTwigIndex;

#include <fog_pars_vertex>

void main() {
  vDist = aDist;
  vDepth = aDepth;
  vBranchId = aBranchId;
  vTwigIndex = aTwigIndex;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`

export const twigFragment = /* glsl */ `
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
uniform float uLit;

varying float vDist;
varying float vDepth;
varying float vBranchId;
varying float vTwigIndex;

#include <fog_pars_fragment>

void main() {
  float lead = uScanRadius - vDist;

  // Nothing beyond the wavefront exists yet.
  if (lead < 0.0) discard;

  // Um galhinho por parágrafo lido. O inteiro decide se ele existe; a fração
  // faz o da frente crescer, pra que a leitura empurre o galho em vez de
  // piscar mais um pedaço a cada parágrafo.
  float delta = uLit - vTwigIndex;
  if (delta < 0.0) discard;
  float grow = clamp(delta, 0.0, 1.0);

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
  float crest = pow(wave, 2.2) * uHotGain * depthFade * grow;

  vec3 color = uRestColor * rest + uEdgeColor * crest;
  float alpha = clamp(rest + crest, 0.0, 1.0) * uOpacity * grow;

  gl_FragColor = vec4(color * uGain, alpha);

  #include <fog_fragment>
}
`
