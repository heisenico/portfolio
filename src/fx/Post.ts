/**
 * Post-processing chain.
 *
 * Bloom is not decoration here — it is what turns saturated one-pixel lines
 * into something that reads as light. The wireframe deliberately renders past
 * 1.0 at the wavefront so bloom has something to catch.
 *
 * Order matters: bloom works in linear HDR, `OutputPass` applies tone mapping
 * and sRGB encoding, and the grade runs last in display space.
 */

import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { Quality } from '../core/Quality'
import type { Stage } from '../core/Stage'
import { finishShader } from './shaders/finish'

const BLOOM_STRENGTH = 0.92
const BLOOM_RADIUS = 0.62
/** Low, because most of the scene sits well under 1.0 and still wants a halo. */
const BLOOM_THRESHOLD = 0.1

export class Post {
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private finish: ShaderPass
  private target: WebGLRenderTarget

  constructor(stage: Stage, private quality: Quality) {
    const size = stage.renderer.getDrawingBufferSize(new Vector2())

    // Half-float so bloom sees the real HDR values instead of clipping at 1.0,
    // and 4x MSAA because every subject in this scene is a thin line.
    this.target = new WebGLRenderTarget(size.x, size.y, {
      type: HalfFloatType,
      samples: 4,
    })

    this.composer = new EffectComposer(stage.renderer, this.target)
    this.composer.addPass(new RenderPass(stage.scene, stage.camera))

    this.bloom = new UnrealBloomPass(
      new Vector2(size.x * quality.bloomScale, size.y * quality.bloomScale),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    )
    this.composer.addPass(this.bloom)

    this.composer.addPass(new OutputPass())

    this.finish = new ShaderPass(finishShader)
    this.finish.uniforms['uGrain']!.value = quality.grain ? 0.035 : 0
    this.composer.addPass(this.finish)

    stage.onResize((s) => this.resize(s.width, s.height, s.dpr))
    quality.onDowngrade(() => {
      this.finish.uniforms['uGrain']!.value = quality.grain ? 0.035 : 0
    })
  }

  private resize(width: number, height: number, dpr: number): void {
    const w = Math.max(Math.floor(width * dpr), 1)
    const h = Math.max(Math.floor(height * dpr), 1)
    this.composer.setSize(width, height)
    this.composer.setPixelRatio(dpr)
    this.bloom.setSize(w * this.quality.bloomScale, h * this.quality.bloomScale)
    this.finish.uniforms['uResolution']!.value = [w, h]
  }

  render(_dt: number, elapsed: number): void {
    this.finish.uniforms['uTime']!.value = elapsed
    this.composer.render()
  }

  dispose(): void {
    this.composer.dispose()
    this.target.dispose()
  }
}
