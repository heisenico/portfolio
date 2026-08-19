/**
 * Renderer, scene, camera, and the resize contract.
 *
 * Stage owns the WebGL context and nothing else. It does not know about
 * post-processing — `Post` wraps it — and it does not drive time; `Loop` does.
 */

import {
  ACESFilmicToneMapping,
  Color,
  FogExp2,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three'
import type { Quality } from './Quality'

export const BG_COLOR = 0x04060a
export const FOG_DENSITY = 0.019

export interface StageOptions {
  /** Retain the drawing buffer so screen captures reflect the last render. */
  preserveDrawingBuffer?: boolean | undefined
}

export interface StageSize {
  width: number
  height: number
  dpr: number
}

export class Stage {
  readonly renderer: WebGLRenderer
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly size: StageSize
  /** Scene focal point. The camera rig orbits this, cards anchor around it. */
  readonly target = new Vector2(0, 0)

  private resizeHandlers: ((size: StageSize) => void)[] = []
  private observer: ResizeObserver | undefined
  private initialised = false

  constructor(
    readonly canvas: HTMLCanvasElement,
    private quality: Quality,
    options: StageOptions = {},
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      // Off in production. Without it the drawing buffer may be discarded on
      // composite, so an external screen capture can show a stale frame rather
      // than the frame just rendered.
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    })
    this.renderer.setClearColor(new Color(BG_COLOR), 1)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.22

    this.scene = new Scene()
    this.scene.fog = new FogExp2(BG_COLOR, FOG_DENSITY)

    this.camera = new PerspectiveCamera(46, 1, 0.1, 260)
    this.camera.position.set(0, 6, 30)
    this.camera.lookAt(0, 6, 0)

    this.size = { width: 1, height: 1, dpr: 1 }
    this.applySize()

    window.addEventListener('resize', this.applySize, { passive: true })
    // A page opened in a background tab reports a zero-size viewport, and no
    // `resize` event follows when it is finally shown. ResizeObserver does fire
    // then, so it is the only reliable way to learn the real size.
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.applySize())
      this.observer.observe(document.documentElement)
    }
    // A downgrade lowers the DPR cap, which only takes effect on a resize.
    quality.onDowngrade(() => this.applySize())
  }

  private applySize = (): void => {
    // Never size to zero: WebGL clamps to a 1x1 drawing buffer and everything
    // downstream silently renders nothing.
    const width = Math.max(window.innerWidth || document.documentElement.clientWidth, 1)
    const height = Math.max(window.innerHeight || document.documentElement.clientHeight, 1)
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap)

    // The first call must always run: a hidden tab reports 1x1, which would
    // otherwise match the initial size and skip renderer setup entirely.
    if (
      this.initialised &&
      width === this.size.width &&
      height === this.size.height &&
      dpr === this.size.dpr
    ) {
      return
    }
    this.initialised = true

    this.size.width = width
    this.size.height = height
    this.size.dpr = dpr

    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, false)

    this.camera.aspect = width / height
    // Widen the field of view on portrait phones so the tree still fits.
    this.camera.fov = width / height < 0.85 ? 62 : 46
    this.camera.updateProjectionMatrix()

    for (const fn of this.resizeHandlers) fn(this.size)
  }

  onResize(fn: (size: StageSize) => void): void {
    this.resizeHandlers.push(fn)
    fn(this.size)
  }

  /** Direct render, bypassing post-processing. Used before `Post` is wired. */
  renderDefault(): void {
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    window.removeEventListener('resize', this.applySize)
    this.observer?.disconnect()
    this.renderer.dispose()
  }
}
