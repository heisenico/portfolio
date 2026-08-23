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
  Vector3,
  type PerspectiveCamera,
  type Scene,
} from 'three'
import type { Post } from 'virtual:posts'
import type { CameraRig } from '../core/CameraRig'
import type { Quality } from '../core/Quality'
import { twigFragment, twigVertex } from '../fx/shaders/twig'
import { jitter, mulberry32, randRange } from '../util/rng'
import { clamp01, damp } from '../util/tween'
import type { BranchRecord } from './BranchSystem'

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
 * Tom derivado da primeira tag do post.
 *
 * A faixa é limitada de propósito: o contrato diz que o leitor entra no verde
 * e sai no verde, e uma tag qualquer não pode levar um post pro roxo. Cada
 * assunto ganha um verde próprio, não uma paleta própria.
 */
export function hueDaTag(tag: string | undefined): number {
  if (!tag) return VERDE
  let h = 2166136261
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return VERDE - DERIVA + (Math.abs(h) % (DERIVA * 2 + 1))
}

/**
 * Hash determinístico de string pra semente do rng.
 *
 * Mesmo algoritmo de `hueDaTag` (FNV-1a), mas devolvendo o hash inteiro em
 * vez de um tom limitado — aqui o resultado semeia `mulberry32`, então a
 * faixa não importa, só a reprodutibilidade: o mesmo slug planta sempre o
 * mesmo galhinho.
 */
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
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
const TWIG_BAND = 2.6
const TWIG_REST = 0.46
const TWIG_GAIN = 1.35
const TWIG_HOT_GAIN = 3.1
const TWIG_MAX_DEPTH = 6
/** Bem além do alcance de qualquer galhinho: o gate de distância não é o que
 *  revela este mundo — ver o comentário de `twigFragment`. */
const TWIG_SCAN_RADIUS = 40

/** Velocidade com que `uLit` persegue o alvo de leitura. */
const LIT_LAMBDA = 6

/**
 * O mundo padrão: derivado inteiramente do próprio post.
 *
 * O slug semeia o crescimento, `paragrafos` decide quantos galhinhos existem,
 * e a primeira tag escolhe o tom. Rolar a página avança `progress`, e os
 * galhinhos acendem em ordem — um por parágrafo — de modo que ler o texto é o
 * que faz o galho crescer.
 */
export class GeneratedPostWorld implements PostWorldModule {
  private ctx: PostWorldContext | null = null
  private lines: LineSegments | null = null
  private material: ShaderMaterial | null = null
  private paragrafos = 0
  private lit = -1

  build(ctx: PostWorldContext): void {
    this.ctx = ctx
    const paragrafos = ctx.post.paragrafos
    this.paragrafos = paragrafos
    this.lit = -1

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

    const hue = hueDaTag(ctx.post.tags[0])
    const color = new Color().setHSL(hue / 360, 0.72, 0.6)

    this.material = new ShaderMaterial({
      vertexShader: twigVertex,
      fragmentShader: twigFragment,
      // O par de sombreadores inclui os chunks de fog do three.js, e eles só
      // fazem algo quando `fog: true` — sem isto os galhinhos ficariam sem a
      // neblina da cena que o resto da árvore respeita.
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uScanRadius: { value: TWIG_SCAN_RADIUS },
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

  update(dt: number, _elapsed: number, progress: number): void {
    if (!this.ctx || !this.material) return

    const target = twigLit(progress, this.paragrafos)
    this.lit = this.ctx.quality.reducedMotion ? target : damp(this.lit, target, LIT_LAMBDA, dt)
    this.material.uniforms['uLit']!.value = this.lit
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

/** Mundos à mão que não têm post correspondente. Quase sempre um rename. */
export function orphanWorlds(slugs: string[]): string[] {
  const existem = new Set(slugs)
  return Object.keys(custom)
    .map((k) => k.slice(PREFIXO.length).replace(/\.ts$/, ''))
    .filter((s) => !existem.has(s))
}
