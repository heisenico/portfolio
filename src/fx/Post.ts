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

import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { Pass } from 'three/addons/postprocessing/Pass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { Quality, Tema } from '../core/Quality'
import type { Stage } from '../core/Stage'
import { finishShader } from './shaders/finish'
import { CAT_LAYER } from '../world/Cat'

const BLOOM_STRENGTH = 0.92
const BLOOM_RADIUS = 0.62
/** Low, because most of the scene sits well under 1.0 and still wants a halo. */
const BLOOM_THRESHOLD = 0.1

/** Zero no papel: a referência não tem sombra nenhuma. */
const VIGNETTE_NOITE = 0.85
const VIGNETTE_PAPEL = 0

/**
 * Desenha só a layer do gato por cima do buffer já com bloom, sem limpar a
 * cor. Limpa o depth antes: o quad de tela cheia do bloom pode ter escrito
 * profundidade, e o gato seria recusado inteiro. O custo aceito: galhos na
 * frente do gato não o ocluem no papel — raro na pose atual.
 */
class CatPass extends Pass {
  constructor(
    private scene: Scene,
    private camera: Camera,
  ) {
    super()
    this.needsSwap = false
  }

  override render(renderer: WebGLRenderer, _write: WebGLRenderTarget, read: WebGLRenderTarget): void {
    const mask = this.camera.layers.mask
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(this.renderToScreen ? null : read)
    renderer.clearDepth()
    this.camera.layers.set(CAT_LAYER)
    renderer.render(this.scene, this.camera)
    this.camera.layers.mask = mask
    renderer.autoClear = autoClear
  }
}

export class Post {
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private catPass: CatPass
  private camera: Camera
  private finish: ShaderPass
  private target: WebGLRenderTarget

  constructor(stage: Stage, private quality: Quality) {
    this.camera = stage.camera
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

    this.catPass = new CatPass(stage.scene, stage.camera)
    this.composer.addPass(this.catPass)

    this.composer.addPass(new OutputPass())

    this.finish = new ShaderPass(finishShader)
    this.finish.uniforms['uGrain']!.value = quality.grain ? 0.035 : 0
    this.composer.addPass(this.finish)

    stage.onResize((s) => this.resize(s.width, s.height, s.dpr))
    quality.onDowngrade(() => {
      this.finish.uniforms['uGrain']!.value = quality.grain ? 0.035 : 0
    })

    this.setTema(quality.tema)
    quality.onTema((tema) => this.setTema(tema))
  }

  private resize(width: number, height: number, dpr: number): void {
    const w = Math.max(Math.floor(width * dpr), 1)
    const h = Math.max(Math.floor(height * dpr), 1)
    this.composer.setSize(width, height)
    this.composer.setPixelRatio(dpr)
    this.bloom.setSize(w * this.quality.bloomScale, h * this.quality.bloomScale)
    this.finish.uniforms['uResolution']!.value = [w, h]
  }

  /** Papel inverte o frame e apaga a vinheta; noite é a cena como renderizada. */
  setTema(tema: Tema): void {
    const papel = tema === 'papel'
    this.finish.uniforms['uInvert']!.value = papel ? 1 : 0
    this.finish.uniforms['uVignette']!.value = papel ? VIGNETTE_PAPEL : VIGNETTE_NOITE

    // Câmeras nascem vendo só a layer 0. Na noite o gato entra na passada
    // principal (e ganha o halo âmbar do bloom); no papel sai dela e é
    // desenhado depois pelo CatPass.
    this.catPass.enabled = papel
    if (papel) this.camera.layers.disable(CAT_LAYER)
    else this.camera.layers.enable(CAT_LAYER)
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
