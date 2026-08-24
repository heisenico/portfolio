/**
 * Final grade: inversão de tema, aberração cromática radial, vinheta e grão.
 *
 * Roda depois do tone mapping e da codificação sRGB, então tudo aqui opera
 * em espaço de exibição. A inversão vem antes da vinheta e do grão de
 * propósito: os dois precisam agir sobre a imagem final — no papel, a vinheta
 * escureceria bordas (por isso é zero lá) e o grão vira textura de papel.
 * A aberração fica antes da inversão: as franjas trocam pelas complementares
 * e ninguém nota; um caminho separado não paga o próprio custo.
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
    /** 1 no papel: o frame inteiro vira o negativo. 0 na noite. */
    uInvert: { value: 0 },
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
    uniform float uInvert;

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

      // Tinta sobre papel: o mundo é renderizado como luz e invertido aqui.
      color = mix(color, 1.0 - color, uInvert);

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
