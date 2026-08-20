/**
 * Liquid glass.
 *
 * The part that separates glass from a frosted panel is *refraction*: the
 * backdrop bends near the edges of the pane and stays straight through the
 * middle, the way a real thick lens behaves. Blur alone gives frost.
 *
 * That bend is done with an SVG `feDisplacementMap` applied to the backdrop.
 * The displacement field is generated here on a canvas from the signed distance
 * to a rounded rectangle, so the bend follows the card's actual corner radius
 * rather than approximating it with gradients.
 *
 * Support is real but partial: Chromium honours an SVG filter reference inside
 * `backdrop-filter`; Safari and Firefox do not. This detects that and marks the
 * document, and the stylesheet keeps blur, saturation, the specular rim, and
 * the inner shading in the fallback. The refraction is what is lost.
 */

const FILTER_ID = 'lg-displace'
const MAP_WIDTH = 420
const MAP_HEIGHT = 260
/** Corner radius of the generated profile, in map pixels. */
const MAP_RADIUS = 34
/** How far in from the edge the bend reaches. */
const MAP_THICKNESS = 46

export interface GlassSupport {
  /** True when the backdrop can actually be refracted. */
  refraction: boolean
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * Encode a rounded-rect lens profile into R (x displacement) and G (y).
 * 128 is neutral; the shader-equivalent convention `feDisplacementMap` expects.
 */
function buildDisplacementMap(): string {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_WIDTH
  canvas.height = MAP_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const image = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT)
  const data = image.data

  const halfW = MAP_WIDTH / 2
  const halfH = MAP_HEIGHT / 2

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const px = x + 0.5 - halfW
      const py = y + 0.5 - halfH

      // Signed distance to a rounded rectangle: negative inside.
      const qx = Math.abs(px) - halfW + MAP_RADIUS
      const qy = Math.abs(py) - halfH + MAP_RADIUS
      const mx = Math.max(qx, 0)
      const my = Math.max(qy, 0)
      const outside = Math.hypot(mx, my)
      const distance = outside + Math.min(Math.max(qx, qy), 0) - MAP_RADIUS

      // Outward normal of that surface.
      let nx: number
      let ny: number
      if (outside > 1e-6) {
        nx = (mx / outside) * Math.sign(px)
        ny = (my / outside) * Math.sign(py)
      } else if (qx > qy) {
        nx = Math.sign(px)
        ny = 0
      } else {
        nx = 0
        ny = Math.sign(py)
      }

      // Bend only near the rim; dead flat through the middle, which is what
      // keeps text behind the card readable.
      const inset = -distance
      const strength = 1 - smoothstep(0, MAP_THICKNESS, inset)
      const bend = strength * strength

      const i = (y * MAP_WIDTH + x) * 4
      data[i] = Math.round(128 + nx * bend * 127)
      data[i + 1] = Math.round(128 + ny * bend * 127)
      data[i + 2] = 128
      data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function injectFilter(mapHref: string): void {
  const defs = document.getElementById('lg-defs')
  if (!defs || !mapHref) return

  defs.setAttribute('aria-hidden', 'true')
  defs.innerHTML = `
    <defs>
      <filter
        id="${FILTER_ID}"
        x="0%" y="0%" width="100%" height="100%"
        color-interpolation-filters="sRGB"
      >
        <feImage
          href="${mapHref}"
          x="0" y="0" width="100%" height="100%"
          preserveAspectRatio="none"
          result="lensMap"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="lensMap"
          scale="58"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  `
}

/**
 * Feature-detect and mark the document. Returns what the page actually got, so
 * callers can report it rather than assume it.
 */
export function installLiquidGlass(): GlassSupport {
  const root = document.documentElement

  const supportsBackdrop =
    typeof CSS !== 'undefined' &&
    (CSS.supports('backdrop-filter', 'blur(2px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(2px)'))

  const supportsFilterRef =
    typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', `url(#${FILTER_ID})`)

  const refraction = supportsBackdrop && supportsFilterRef

  if (refraction) injectFilter(buildDisplacementMap())

  root.classList.toggle('lg-refract', refraction)
  root.classList.toggle('lg-fallback', !refraction)
  root.classList.toggle('lg-no-backdrop', !supportsBackdrop)

  return { refraction }
}
