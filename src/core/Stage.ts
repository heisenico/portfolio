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

  constructor(
    readonly canvas: HTMLCanvasElement,
    private quality: Quality,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.renderer.setClearColor(new Color(BG_COLOR), 1)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene = new Scene()
    this.scene.fog = new FogExp2(BG_COLOR, FOG_DENSITY)

    this.camera = new PerspectiveCamera(46, 1, 0.1, 260)
    this.camera.position.set(0, 6, 30)
    this.camera.lookAt(0, 6, 0)

    this.size = { width: 1, height: 1, dpr: 1 }
    this.applySize()

    window.addEventListener('resize', this.applySize, { passive: true })
    // A downgrade lowers the DPR cap, which only takes effect on a resize.
    quality.onDowngrade(() => this.applySize())
  }

  private applySize = (): void => {
    const width = window.innerWidth
    const height = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap)

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
    this.renderer.dispose()
  }
}
