/**
 * Vagalumes.
 *
 * O movimento inteiro (perseguição do ponteiro, atraso por inseto, farfalhar
 * de curl noise) roda na CPU, em `Fireflies.ts` — poucas dezenas de
 * partículas com estado próprio não valem levar tudo isso pro shader, ao
 * contrário dos motes. Este par só desenha: tamanho por perspectiva e o
 * piscar, os dois únicos efeitos baratos o bastante pra ficarem na GPU.
 */

export const firefliesVertex = /* glsl */ `
attribute float aRate;
attribute float aPhase;

uniform float uSize;
uniform float uDpr;

varying float vRate;
varying float vPhase;

void main() {
  vRate = aRate;
  vPhase = aPhase;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Perspective size attenuation, scaled by device pixel ratio so fireflies
  // are the same physical size on any display.
  gl_PointSize = uSize * uDpr * (14.0 / -mvPosition.z);
}
`

export const firefliesFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;

varying float vRate;
varying float vPhase;

void main() {
  // Soft round sprite from the point coordinate.
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p);
  if (r > 0.5) discard;

  float core = pow(1.0 - smoothstep(0.0, 0.5, r), 2.4);

  // Each firefly blinks on its own rate and phase, with a long dark part of
  // the cycle rather than a smooth breathing pulse.
  float blink = 0.35 + 0.65 * pow(sin(uTime * vRate + vPhase) * 0.5 + 0.5, 3.0);

  float alpha = core * blink * uOpacity;
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(uColor * alpha, alpha);
}
`
