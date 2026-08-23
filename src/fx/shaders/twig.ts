/**
 * Twig wireframe with a growth-driven scan reveal, gated a second way.
 *
 * A deliberate copy of the `branch.ts` pair, not a parameterisation of it. The
 * tree's shader runs over roughly forty thousand vertices every frame and is
 * the single hottest program in the scene; adding a branch to that inner loop
 * so a handful of twigs could pick a second gating mode would tax it for the
 * rest of the site's life. Two readable programs beat one clever one here.
 *
 * The extra gate is `aTwigIndex`: a generated post world lights one twig per
 * paragraph read. `branch.ts` gates on distance from a scene-wide scan origin
 * (`uScanRadius`); this world has no such origin, so the wavefront it draws is
 * local to each twig instead. `uLit - vTwigIndex` decides whether a twig has
 * started growing at all (the whole-twig gate, unchanged in spirit from the
 * original design), and its fractional part then scales into a **local**
 * front position along that one twig's own length (`vDist`, which here means
 * distance from the twig's base, not from a scan origin) — so the twig is
 * drawn from its base outward with a bright leading edge, exactly like the
 * tree's own wavefront, just scoped to ~1.4 world units instead of the whole
 * canopy. `uScanRadius` and the tree-scale `uBand` are gone because at twig
 * scale they were either dead (a band tuned for tens of units reads as flat
 * across 1.4) or meaningless (there is no shared scan origin to be distant
 * from). The front is allowed to travel `uBand * 2` past the twig's physical
 * end once fully grown — the same margin `ScanReveal` bakes into its own
 * `maxRadius` (`bounds + BAND * 2`) — so a finished twig settles to `rest`
 * instead of keeping a permanently lit tip.
 */

export const twigVertex = /* glsl */ `
attribute float aDist;
attribute float aDepth;
attribute float aBranchId;
attribute float aTwigIndex;

uniform vec2 uWind;
uniform float uWindTime;

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

  // O balanço cresce com a altura acima das raízes, então o tronco segura e a
  // copa se mexe. Balanço uniforme lê como a imagem inteira tremendo.
  float sway = max(position.y + 2.4, 0.0) * 0.045;
  float phase = uWindTime * 2.2 + position.y * 0.35;
  vec3 bent = position;
  bent.xz += uWind * sway * (0.75 + 0.25 * sin(phase));

  vec4 mvPosition = modelViewMatrix * vec4(bent, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`

export const twigFragment = /* glsl */ `
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
uniform float uTwigLength;

varying float vDist;
varying float vDepth;
varying float vBranchId;
varying float vTwigIndex;

#include <fog_pars_fragment>

void main() {
  // Um galhinho por parágrafo lido: o inteiro decide se ele já começou a
  // crescer.
  float delta = uLit - vTwigIndex;
  if (delta < 0.0) discard;
  float grow = clamp(delta, 0.0, 1.0);

  // A frente de crescimento, em distância ao longo do próprio galhinho — não
  // da cena. Ela anda até uBand*2 além da ponta física (o mesmo truque de
  // uMaxRadius do ScanReveal), pra que um galhinho pronto assente em vez de
  // manter a ponta acesa pra sempre.
  float front = grow * (uTwigLength + uBand * 2.0);
  float lead = front - vDist;

  // Nada além da frente de crescimento existe ainda. <=, não só <: um
  // vértice exatamente na origem de escaneamento da própria peça (vDist 0)
  // passaria por essa checagem no instante em que a frente ainda é 0,
  // acendendo antes da janela dele abrir — mesmo defeito do branch.ts.
  if (lead <= 0.0) discard;

  // 1 bem na frente, caindo pra 0 ao longo de uBand atrás dela.
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

  vec3 color = uRestColor * rest + uEdgeColor * crest;
  float alpha = clamp(rest + crest, 0.0, 1.0) * uOpacity;

  gl_FragColor = vec4(color * uGain, alpha);

  #include <fog_fragment>
}
`
