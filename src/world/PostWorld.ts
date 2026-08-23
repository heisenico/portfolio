/**
 * O que cresce de um galho quando o leitor abre um post.
 *
 * `PostWorldModule` é o contrato: `build` planta o mundo, `update` o faz
 * responder à leitura, `dispose` devolve tudo. `GeneratedPostWorld` é o mundo
 * padrão — derivado só do próprio post, pra que publicar nunca dependa de uma
 * cena feita à mão. `loadPostWorld` é a escada de saída: um post pode trocar
 * o gerado por um `content/worlds/<slug>.ts` inteiro.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  type PerspectiveCamera,
  type Scene,
} from 'three'
import type { Post } from 'virtual:posts'
import type { CameraRig } from '../core/CameraRig'
import type { Quality } from '../core/Quality'
import { twigFragment, twigVertex } from '../fx/shaders/twig'
import { jitter, mulberry32, randRange } from '../util/rng'
import { clamp01, damp, lerp } from '../util/tween'
import type { BranchRecord } from './BranchSystem'
import type { Wind } from './Wind'

/** Tom base da casa, em graus. Todo mundo sai daqui e volta pra cá. */
const VERDE = 150
/** Deriva máxima permitida pelo contrato do mundo. */
const DERIVA = 70

/**
 * Quantos galhinhos estão acesos, como o shader espera ler.
 *
 * O gate é `aTwigIndex <= uLit` e o primeiro galhinho é o índice 0, então
 * "nenhum aceso" é -1 e não 0. A parte fracionária serve pro galhinho da
 * frente crescer pela metade, pra que o avanço seja contínuo em vez de
 * degrau a degrau.
 */
export function twigLit(progress: number, total: number): number {
  if (total <= 0) return -1
  return clamp01(progress) * total - 1
}

/**
 * Uma janela do progresso, normalizada de 0 a 1.
 *
 * É o único jeito que um mundo tem de dizer "isto acontece entre aqui e ali".
 * Toda batida de todo mundo — gerado ou à mão — sai daqui, e é por isso que
 * nenhuma delas precisa de relógio próprio: o relógio é a leitura.
 */
export function beat(progress: number, de: number, ate: number): number {
  if (ate <= de) return progress >= de ? 1 : 0
  return clamp01((progress - de) / (ate - de))
}

/**
 * FNV-1a de 32 bits.
 *
 * Base de todo hash determinístico de string deste arquivo — `hueDaTag` e a
 * semente do rng do galhinho usam o mesmo algoritmo; só o que cada um faz com
 * o inteiro resultante muda.
 */
function fnv1a(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h
}

/**
 * Tom derivado da primeira tag do post.
 *
 * A faixa é limitada de propósito: o contrato diz que o leitor entra no verde
 * e sai no verde, e uma tag qualquer não pode levar um post pro roxo. Cada
 * assunto ganha um verde próprio, não uma paleta própria.
 */
export function hueDaTag(tag: string | undefined): number {
  if (!tag) return VERDE
  return VERDE - DERIVA + (Math.abs(fnv1a(tag)) % (DERIVA * 2 + 1))
}

/**
 * Hash determinístico de string pra semente do rng.
 *
 * Mesmo `fnv1a` de `hueDaTag`, mas devolvendo o hash inteiro em vez de um tom
 * limitado — aqui o resultado semeia `mulberry32`, então a faixa não importa,
 * só a reprodutibilidade: o mesmo slug planta sempre o mesmo galhinho.
 */
function hashSeed(s: string): number {
  return fnv1a(s) >>> 0
}

/** Progresso em que a deriva de cor termina de entrar. */
const HUE_ENTRA_ATE = 0.15
/** Progresso em que a deriva começa a voltar pro verde. */
const HUE_SAI_DE = 0.8
/** Contrato do mundo: de volta ao verde a partir daqui — clause #3. */
const HUE_VERDE_DESDE = 0.97

/**
 * Envelope de cor ao longo da leitura: verde no início, deriva pro tom da tag
 * no meio, verde de novo a partir de `HUE_VERDE_DESDE`.
 *
 * O contrato do mundo diz que o leitor entra no verde da árvore e sai nele —
 * a árvore é a única coisa no site que nunca muda, e é dela que o leitor
 * decola e é a ela que volta. Uma tag escolhe pra onde a cor deriva, não se
 * ela deriva: por isso isto é uma função de `progress`, não de `hueDaTag`
 * sozinho.
 */
export function hueEnvelope(progress: number, hue: number): number {
  const entra = beat(progress, 0, HUE_ENTRA_ATE)
  const sai = 1 - beat(progress, HUE_SAI_DE, HUE_VERDE_DESDE)
  return lerp(VERDE, hue, Math.min(entra, sai))
}

const UP = new Vector3(0, 1, 0)
const SIDE = new Vector3(1, 0, 0)

/**
 * Um vetor unitário qualquer perpendicular a `v`.
 *
 * Mesma escolha de eixo que `BranchSystem` usa pra crescer a árvore, pra que
 * os galhinhos dobrem do mesmo jeito que os galhos dobram — copiado, não
 * importado, porque `BranchSystem` não expõe isto e não devia: é um detalhe
 * de como um segmento cresce, não uma interface entre módulos.
 */
function perpendicular(v: Vector3, out: Vector3): Vector3 {
  const axis = Math.abs(v.y) < 0.9 ? UP : SIDE
  return out.copy(v).cross(axis).normalize()
}

export interface PostWorldContext {
  scene: Scene
  camera: PerspectiveCamera
  branch: BranchRecord
  post: Post
  quality: Quality
  rig: CameraRig
  /** Onde um mundo pode pendurar overlay em DOM, se precisar de um. */
  overlay: HTMLElement
  /** O mesmo vento que balança a copa — pra que os galhinhos gerados
   *  balancem junto com o galho de onde nascem. */
  wind: Wind
}

export interface PostWorldModule {
  build(ctx: PostWorldContext): void
  update(dt: number, elapsed: number, progress: number): void
  dispose(): void
}

/** Sub-segmentos por galhinho — a mesma malha fina que os galhos da árvore usam. */
const TWIG_SUB_SEGMENTS = 4
/** Comprimento total de cada galhinho, em unidades de mundo. */
const TWIG_LENGTH = 1.4
/** Meio-ângulo do leque em que os galhinhos se espalham a partir do galho. */
const TWIG_SPREAD = 0.6

/** Mesma sintonia visual do `ScanReveal` da árvore, pra que os galhinhos leiam
 *  como o mesmo material — não uma camada nova por cima. */
const TWIG_REST = 0.46
const TWIG_GAIN = 1.35
const TWIG_HOT_GAIN = 3.1
const TWIG_MAX_DEPTH = 6
/** Largura da frente acesa, em unidades de mundo. Encolhida a partir do
 *  `BAND = 2.6` do `ScanReveal`: aquele valor foi calibrado pra dezenas de
 *  unidades de árvore e lia como plano nos ~1.4 de um galhinho inteiro. */
const TWIG_BAND = 0.35

/** Velocidade com que `uLit` persegue o alvo de leitura. */
const LIT_LAMBDA = 6
/** Velocidade com que a cor persegue o envelope — mais lenta que o
 *  crescimento, pra que a deriva de tom nunca leia como um flash. */
const HUE_LAMBDA = 4

/**
 * O mundo padrão: derivado inteiramente do próprio post.
 *
 * O slug semeia o crescimento, `paragrafos` decide quantos galhinhos existem,
 * e a primeira tag escolhe o tom pra onde a cor deriva. Rolar a página avança
 * `progress`, e os galhinhos acendem em ordem — um por parágrafo — de modo
 * que ler o texto é o que faz o galho crescer.
 */
export class GeneratedPostWorld implements PostWorldModule {
  private ctx: PostWorldContext | null = null
  private lines: LineSegments | null = null
  private material: ShaderMaterial | null = null
  private paragrafos = 0
  private lit = -1
  private hueAlvo = VERDE
  private hueAtual = VERDE

  build(ctx: PostWorldContext): void {
    this.ctx = ctx
    const paragrafos = ctx.post.paragrafos
    this.paragrafos = paragrafos
    this.lit = -1
    this.hueAlvo = hueDaTag(ctx.post.tags[0])
    this.hueAtual = VERDE

    const rng = mulberry32(hashSeed(ctx.post.slug))
    const along = ctx.branch.along
    // Um galhinho é sempre uma folha a mais que o galho que o carrega — a
    // mesma progressão de profundidade que a árvore usa pra escolher o quanto
    // cada nível serpenteia.
    const depth = ctx.branch.depth + 1
    const wander = 0.06 + depth * 0.03
    const step = TWIG_LENGTH / TWIG_SUB_SEGMENTS

    const positions: number[] = []
    const dists: number[] = []
    const depths: number[] = []
    const branchIds: number[] = []
    const twigIndices: number[] = []

    const axis = new Vector3()
    const dir = new Vector3()
    const cursor = new Vector3()
    const next = new Vector3()

    for (let i = 0; i < paragrafos; i++) {
      const roll = (i / paragrafos) * Math.PI * 2 + jitter(rng, 0.35)
      const tilt = randRange(rng, TWIG_SPREAD * 0.5, TWIG_SPREAD)

      perpendicular(along, axis)
      dir.copy(along).applyAxisAngle(axis, tilt).applyAxisAngle(along, roll).normalize()

      cursor.copy(ctx.branch.tip)
      let travelled = 0

      for (let s = 0; s < TWIG_SUB_SEGMENTS; s++) {
        perpendicular(dir, axis)
        dir.applyAxisAngle(axis, randRange(rng, -wander, wander))
        dir.normalize()
        next.copy(cursor).addScaledVector(dir, step)
        travelled += step

        positions.push(cursor.x, cursor.y, cursor.z, next.x, next.y, next.z)
        dists.push(travelled - step, travelled)
        depths.push(depth, depth)
        branchIds.push(ctx.branch.id, ctx.branch.id)
        twigIndices.push(i, i)

        cursor.copy(next)
      }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('aDist', new BufferAttribute(new Float32Array(dists), 1))
    geometry.setAttribute('aDepth', new BufferAttribute(new Float32Array(depths), 1))
    geometry.setAttribute('aBranchId', new BufferAttribute(new Float32Array(branchIds), 1))
    geometry.setAttribute('aTwigIndex', new BufferAttribute(new Float32Array(twigIndices), 1))

    const color = new Color().setHSL(this.hueAtual / 360, 0.72, 0.6)

    this.material = new ShaderMaterial({
      vertexShader: twigVertex,
      fragmentShader: twigFragment,
      // O par de sombreadores inclui os chunks de fog do three.js, e eles só
      // fazem algo quando `fog: true` — sem isto os galhinhos ficariam sem a
      // neblina da cena que o resto da árvore respeita.
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uBand: { value: TWIG_BAND },
          uRest: { value: TWIG_REST },
          uMaxDepth: { value: TWIG_MAX_DEPTH },
          uTime: { value: 0 },
          uRestColor: { value: color.clone() },
          uEdgeColor: { value: color.clone() },
          uOpacity: { value: 1 },
          uGain: { value: TWIG_GAIN },
          uHotGain: { value: TWIG_HOT_GAIN },
          uLit: { value: this.lit },
          uTwigLength: { value: TWIG_LENGTH },
          uWind: { value: new Vector2() },
          uWindTime: { value: 0 },
        },
      ]),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: true,
    })

    this.lines = new LineSegments(geometry, this.material)
    this.lines.frustumCulled = false
    ctx.scene.add(this.lines)
  }

  update(dt: number, elapsed: number, progress: number): void {
    if (!this.ctx || !this.material) return

    const reduced = this.ctx.quality.reducedMotion

    const target = twigLit(progress, this.paragrafos)
    this.lit = reduced ? target : damp(this.lit, target, LIT_LAMBDA, dt)
    this.material.uniforms['uLit']!.value = this.lit

    const hueTarget = hueEnvelope(progress, this.hueAlvo)
    this.hueAtual = reduced ? hueTarget : damp(this.hueAtual, hueTarget, HUE_LAMBDA, dt)
    const hue01 = this.hueAtual / 360
    ;(this.material.uniforms['uRestColor']!.value as Color).setHSL(hue01, 0.72, 0.6)
    ;(this.material.uniforms['uEdgeColor']!.value as Color).setHSL(hue01, 0.72, 0.6)

    // O ripple do shader precisa de tempo real pra viajar — mas só quando o
    // movimento não está reduzido. Sob `reducedMotion`, `uTime` fica parado
    // no valor que já tinha, igual `uLit` e a cor já fazem nesta função.
    //
    // O vento segue a mesma regra: o galhinho pendura no galho que a copa
    // balança, e um galho rígido balançando um galhinho parado destacaria os
    // dois — mas sob `reducedMotion` nem a copa se mexe, então o vento fica
    // no que já tinha, igual tudo o mais aqui.
    if (!reduced) {
      this.material.uniforms['uTime']!.value = elapsed
      ;(this.material.uniforms['uWind']!.value as Vector2).copy(this.ctx.wind.vector)
      this.material.uniforms['uWindTime']!.value = elapsed
    }
  }

  dispose(): void {
    if (this.lines) {
      this.ctx?.scene.remove(this.lines)
      this.lines.geometry.dispose()
    }
    this.material?.dispose()
    this.lines = null
    this.material = null
    this.ctx = null
  }
}

/**
 * Um post pode trocar o mundo gerado inteiro por um à mão: basta
 * `content/worlds/<slug>.ts` exportando um `PostWorldModule` como default.
 *
 * A busca é pelo slug, e é aí que mora a única armadilha: renomear o post sem
 * renomear o arquivo faz o post cair no mundo genérico em silêncio. Por isso
 * `orphanWorlds` existe e `main.ts` grita em dev.
 */
const custom = import.meta.glob<{ default: PostWorldModule }>('/content/worlds/*.ts')

const PREFIXO = '/content/worlds/'

export async function loadPostWorld(post: Post): Promise<PostWorldModule> {
  const loader = custom[`${PREFIXO}${post.slug}.ts`]
  if (loader) return (await loader()).default
  return new GeneratedPostWorld()
}

/**
 * Mundos à mão que não têm post correspondente. Quase sempre um rename.
 *
 * `paths` tem um default pro glob real do Vite e existe como parâmetro só pra
 * que isto seja testável sem depender de arquivos de verdade em
 * `content/worlds/` — o mesmo corte que `Quality.ts` faz entre `readHints` e
 * `tierFromHints`.
 */
export function orphanWorlds(slugs: string[], paths: string[] = Object.keys(custom)): string[] {
  const existem = new Set(slugs)
  return paths
    .map((k) => k.slice(PREFIXO.length).replace(/\.ts$/, ''))
    .filter((s) => !existem.has(s))
}
