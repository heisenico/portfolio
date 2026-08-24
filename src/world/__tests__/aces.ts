/**
 * O fim do pipeline, em JS, só para teste.
 *
 * O frame sai do `OutputPass` passando por `ACESFilmicToneMapping` e pela
 * codificação sRGB, e só então `fx/shaders/finish.ts` inverte (no papel). ACES
 * não é simétrico sob `1 - x`, então "que uniform o gato precisa para sair
 * `#ffc27a` na tela" não se responde no olho nem com o complemento: se responde
 * rodando o mesmo pipeline aqui.
 *
 * Tudo abaixo é cópia literal de `three` r185:
 * - `src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js`
 *   (`ACESFilmicToneMapping`, `RRTAndODTFit` e as duas matrizes);
 * - `src/math/ColorManagement.js` (`SRGBToLinear`, `LinearToSRGB`), que é o que
 *   `Color.setHex` aplica ao hex — `setHex` assume `SRGBColorSpace` e converte
 *   para o espaço linear de trabalho, porque `ColorManagement.enabled` é `true`
 *   por padrão em r185.
 *
 * O `sRGBTransferOETF` do GLSL (`colorspace_pars_fragment.glsl.js`) usa os
 * mesmos coeficientes de `LinearToSRGB`, então uma função serve para os dois.
 */

/** `SRGBToLinear` de `three/src/math/ColorManagement.js`. */
export function srgbToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4)
}

/** `LinearToSRGB` — e o `sRGBTransferOETF` do `OutputPass`, que é idêntico. */
export function linearToSrgb(c: number): number {
  return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055
}

type RGB = [number, number, number]

/**
 * As matrizes ACES, transpostas.
 *
 * No GLSL, `mat3(vec3 a, vec3 b, vec3 c)` monta a matriz por **coluna** — cada
 * `vec3` do fonte é uma coluna, não uma linha (o próprio comentário de three
 * diz "transposed from source"). Aqui as constantes estão por linha, já
 * transpostas de volta, para `multiplica` ser um produto linha × vetor comum.
 */
const ACES_INPUT: readonly RGB[] = [
  [0.59719, 0.35458, 0.04823],
  [0.076, 0.90834, 0.01566],
  [0.0284, 0.13383, 0.83777],
]

const ACES_OUTPUT: readonly RGB[] = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
]

function multiplica(m: readonly RGB[], v: RGB): RGB {
  return [
    m[0]![0] * v[0] + m[0]![1] * v[1] + m[0]![2] * v[2],
    m[1]![0] * v[0] + m[1]![1] * v[1] + m[1]![2] * v[2],
    m[2]![0] * v[0] + m[2]![1] * v[1] + m[2]![2] * v[2],
  ]
}

/** `saturate(a)` do GLSL: `clamp(a, 0.0, 1.0)`. */
function saturate(x: number): number {
  return Math.min(1, Math.max(0, x))
}

/** `RRTAndODTFit`, canal a canal. */
function rrtEOdt(v: RGB): RGB {
  return v.map((x) => {
    const a = x * (x + 0.0245786) - 0.000090537
    const b = x * (0.983729 * x + 0.432951) + 0.238081
    return a / b
  }) as RGB
}

/** `ACESFilmicToneMapping`: linear HDR entra, linear exibível sai. */
export function acesFilmic(rgb: RGB, exposure: number): RGB {
  // `color *= toneMappingExposure / 0.6` — o 1/0.6 é do próprio three.
  const escalado = rgb.map((x) => x * (exposure / 0.6)) as RGB
  const emAp1 = multiplica(ACES_INPUT, escalado)
  const ajustado = rrtEOdt(emAp1)
  const emSrgb = multiplica(ACES_OUTPUT, ajustado)
  return emSrgb.map(saturate) as RGB
}

/**
 * A cor que um pixel totalmente aceso daquele uniform tem na tela, em 0–255.
 *
 * `hexUniform` é lido como `Color.setHex` lê (sRGB → linear), passa por ACES na
 * exposição do renderer, volta para sRGB no `OutputPass` e, se `invert`,
 * recebe o `1.0 - color` do passe final — nessa ordem, que é a do pipeline.
 */
export function naTela(hexUniform: number, exposure = 1.22, invert = false): RGB {
  const linear = [(hexUniform >> 16) & 255, (hexUniform >> 8) & 255, hexUniform & 255].map((v) =>
    srgbToLinear(v / 255),
  ) as RGB
  const exibicao = acesFilmic(linear, exposure).map(linearToSrgb) as RGB
  const final = invert ? (exibicao.map((x) => 1 - x) as RGB) : exibicao
  return final.map((x) => Math.round(saturate(x) * 255)) as RGB
}
