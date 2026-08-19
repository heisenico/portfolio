/**
 * Final grade: radial chromatic aberration, vignette, and film grain.
 *
 * Runs after tone mapping and sRGB encoding, so grain and vignette operate in
 * display space where their strength is predictable. Applying them in linear
 * space makes the grain invisible in shadows and overpowering in highlights.
 */

export const finishShader = {
  name: 'FinishShader',

  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: [1, 1] },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.85 },
    uAberration: { value: 0.0035 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAberration;

    varying vec2 vUv;

    void main() {
      vec2 centred = vUv - 0.5;
      float r2 = dot(centred, centred);

      // Aberration scales with r^2, so the centre stays clean and only the
      // corners fringe — the way a real lens behaves.
      vec2 offset = centred * r2 * uAberration * 4.0;

      vec4 base = texture2D(tDiffuse, vUv);
      float red = texture2D(tDiffuse, vUv - offset).r;
      float blue = texture2D(tDiffuse, vUv + offset).b;
      vec3 color = vec3(red, base.g, blue);

      color *= 1.0 - smoothstep(0.06, 0.58, r2) * uVignette;

      // Grain is re-seeded per frame so it shimmers instead of sitting still.
      float n = fract(
        sin(dot(vUv * uResolution + uTime * 91.7, vec2(12.9898, 78.233))) * 43758.5453
      );
      color += (n - 0.5) * uGrain;

      gl_FragColor = vec4(color, base.a);
    }
  `,
}
