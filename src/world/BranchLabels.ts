/**
 * O blog visto de dentro da árvore: cada post mora num galho de verdade, com
 * um rótulo que flutua sobre a ponta dele.
 *
 * `assignBranches` decide qual galho cabe a qual post — puro, sem three.js —
 * e `BranchLabels` desenha o resultado como sprites billboardados mais uma
 * linha fina que prende cada rótulo à árvore. As duas coisas vivem no mesmo
 * arquivo porque uma não existe sem a outra: o desenho é só a atribuição
 * tornada visível.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  type PerspectiveCamera,
  type Raycaster,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import type { Quality } from '../core/Quality'
import { damp } from '../util/tween'
import type { BranchRecord } from './BranchSystem'

/** Profundidade em que um galho é grosso o bastante pra carregar um rótulo. */
const PROFUNDIDADE_MIN = 2
const PROFUNDIDADE_MAX = 4
/** Distância mínima entre pontas escolhidas, em unidades de mundo. */
const SEPARACAO = 1.6

export interface PostBranch {
  slug: string
  titulo: string
  branch: BranchRecord
}

/**
 * Casa cada post com um galho de verdade.
 *
 * Determinística de ponta a ponta: nenhuma aleatoriedade, e a ordem de entrada
 * manda. Como `posts` chega mais novo primeiro e um post novo entra na frente,
 * publicar *não* embaralha os galhos de quem já estava lá — o post de ontem
 * continua no galho de ontem, que é o que faz a árvore ser um lugar em vez de
 * um sorteio.
 *
 * Três passadas, cada uma afrouxando uma exigência: primeiro galho ideal bem
 * espaçado, depois galho ideal em qualquer lugar, depois qualquer galho. Se
 * ainda faltar, explode — um post sem galho não tem como aparecer no blog, e
 * sumir calado é pior que não construir.
 */
export function assignBranches(
  posts: { slug: string; titulo: string; data: string }[],
  branches: BranchRecord[],
): PostBranch[] {
  if (posts.length === 0) return []

  // Baixo pra cima. O post mais antigo é atribuído primeiro e fica no galho
  // mais baixo; o mais novo sobe. É como galho cresce, e é o que faz a copa
  // ser uma linha do tempo em vez de uma prateleira.
  const porAltura = (a: BranchRecord, b: BranchRecord): number => a.tip.y - b.tip.y || a.id - b.id
  const ideais = branches
    .filter((b) => b.depth >= PROFUNDIDADE_MIN && b.depth <= PROFUNDIDADE_MAX)
    .sort(porAltura)
  const resto = branches
    .filter((b) => b.depth < PROFUNDIDADE_MIN || b.depth > PROFUNDIDADE_MAX)
    .sort(porAltura)

  const usados = new Set<number>()
  const escolhidos: BranchRecord[] = []

  function pegar(pool: BranchRecord[], separacao: number): BranchRecord | null {
    for (const b of pool) {
      if (usados.has(b.id)) continue
      if (separacao > 0 && escolhidos.some((c) => c.tip.distanceTo(b.tip) < separacao)) continue
      usados.add(b.id)
      escolhidos.push(b)
      return b
    }
    return null
  }

  // A atribuição corre em ordem de publicação, não na ordem em que a lista
  // chegou. `virtual:posts` entrega mais novo primeiro, então atribuir na
  // ordem recebida faria cada post novo empurrar todo mundo pro galho do
  // vizinho — a árvore inteira se reorganizaria a cada publicação. Correndo
  // do mais antigo pro mais novo, quem já tem galho fica com ele pra sempre.
  const publicacao = [...posts].sort(
    (a, b) => a.data.localeCompare(b.data) || a.slug.localeCompare(b.slug),
  )

  const porSlug = new Map<string, BranchRecord>()
  for (const post of publicacao) {
    const branch = pegar(ideais, SEPARACAO) ?? pegar(ideais, 0) ?? pegar(resto, 0)
    if (!branch) {
      throw new Error(
        `assignBranches: ${posts.length} posts e só ${branches.length} galhos na árvore`,
      )
    }
    porSlug.set(post.slug, branch)
  }

  return posts.map((post) => ({
    slug: post.slug,
    titulo: post.titulo,
    branch: porSlug.get(post.slug)!,
  }))
}

/** Altura do rótulo em unidades de mundo. A largura sai do texto. */
const ALTURA = 0.42
/** Quanto o rótulo flutua acima da ponta do galho. */
const OFFSET = 0.55
const COR_REPOUSO = '#9fbfae'
const COR_ACESA = '#d9ffe9'
/** Velocidade com que o realce de hover se aproxima do alvo. */
const REALCE_LAMBDA = 10
/** Amplitude da respiração vertical de cada rótulo, em unidades de mundo. */
const BOB_AMPLITUDE = 0.04

/** Fonte do rótulo, em px de canvas, antes do fator de nitidez. Só a
 *  proporção largura/altura do texto importa pro resultado final — `ALTURA`
 *  fixa a altura no mundo, então isto só afeta a nitidez da textura. */
const FONTE_PX = 32
/** Mesmo peso dos títulos do resto da página (`.hero h1`, `.bloco h2`). */
const FONTE_PESO = 500
const PAD_X = 16
const PAD_Y = 10

/** Opacidade da linha que prende o rótulo à ponta do galho. */
const LINHA_OPACIDADE = 0.5

interface Rotulo {
  slug: string
  sprite: Sprite
  material: SpriteMaterial
  texture: CanvasTexture
  branchId: number
  ancora: Vector3
  alvo: number
  atual: number
}

/** Lê `--font-sans` do documento, com um fallback caso a variável não exista. */
function lerFamiliaDaFonte(): string {
  const valor = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
  return valor || 'sans-serif'
}

/**
 * Rasteriza um título numa textura de canvas, dimensionada pro próprio texto.
 *
 * Branco sobre transparente: o tom vem de `SpriteMaterial.color`, então
 * acender um rótulo não pede re-rasterizar nada.
 */
function construirTextura(
  titulo: string,
  familia: string,
): { texture: CanvasTexture; aspecto: number } {
  const escala = 2 * (window.devicePixelRatio || 1)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('BranchLabels: sem contexto 2d pra desenhar o rótulo')

  const fontePx = FONTE_PX * escala
  const padX = Math.round(PAD_X * escala)
  const padY = Math.round(PAD_Y * escala)

  ctx.font = `${FONTE_PESO} ${fontePx}px ${familia}`
  const largura = Math.ceil(ctx.measureText(titulo).width)

  canvas.width = largura + padX * 2
  canvas.height = fontePx + padY * 2

  // Redimensionar o canvas limpa o estado do contexto — a fonte precisa ser
  // reaplicada antes de desenhar.
  ctx.font = `${FONTE_PESO} ${fontePx}px ${familia}`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(titulo, padX, canvas.height / 2)

  const texture = new CanvasTexture(canvas)
  return { texture, aspecto: canvas.width / canvas.height }
}

/**
 * Os rótulos do blog: um sprite billboardado por post, cada um preso à ponta
 * do seu galho por uma linha fina.
 *
 * Sprites em vez de DOM: um rótulo em DOM sobre uma cena 3D precisa ser
 * reposicionado todo frame a partir de um ponto projetado, o que custa uma
 * leitura de layout por rótulo por frame e sempre atrasa um frame em relação
 * à câmera. Um sprite billboardado já *está* no mundo.
 */
export class BranchLabels {
  readonly group = new Group()

  private rotulos: Rotulo[] = []
  private lineGeometry = new BufferGeometry()
  private readonly lineMaterial: LineBasicMaterial
  private readonly lines: LineSegments
  private readonly corRepouso = new Color(COR_REPOUSO)
  private readonly corAcesa = new Color(COR_ACESA)

  constructor(private quality: Quality) {
    this.lineGeometry.setAttribute('position', new BufferAttribute(new Float32Array(0), 3))

    this.lineMaterial = new LineBasicMaterial({
      color: this.corRepouso.clone(),
      transparent: true,
      opacity: LINHA_OPACIDADE,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    this.lines = new LineSegments(this.lineGeometry, this.lineMaterial)
    this.lines.frustumCulled = false
    this.group.add(this.lines)
  }

  /**
   * Constrói um sprite por post. Espera `document.fonts.ready` antes de medir
   * o texto — medir antes da webfont resolver dá métrica de fonte de reserva,
   * e o rótulo fica com a largura errada pelo resto da sessão.
   */
  setPosts(assignments: PostBranch[]): void {
    this.limparRotulos()

    const construir = (): void => {
      const familia = lerFamiliaDaFonte()
      for (const post of assignments) {
        const { texture, aspecto } = construirTextura(post.titulo, familia)
        const material = new SpriteMaterial({
          map: texture,
          color: this.corRepouso.clone(),
          transparent: true,
          depthWrite: false,
        })
        const sprite = new Sprite(material)
        sprite.scale.set(ALTURA * aspecto, ALTURA, 1)
        sprite.userData['slug'] = post.slug

        const ancora = post.branch.tip.clone().add(new Vector3(0, OFFSET, 0))
        sprite.position.copy(ancora)
        this.group.add(sprite)

        this.rotulos.push({
          slug: post.slug,
          sprite,
          material,
          texture,
          branchId: post.branch.id,
          ancora,
          alvo: 0,
          atual: 0,
        })
      }
      this.reconstruirLinha()
    }

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      // Sem `.catch` isto é uma rejeição de promise não tratada — vira erro
      // de console sozinho, contra o release gate de zero erro. `construir`
      // pode jogar (`construirTextura` joga sem contexto 2d), e falha alta é
      // o combinado do projeto: registra, não engole.
      document.fonts.ready.then(construir).catch((erro: unknown) => {
        console.error('[portfolio] falha construindo os rótulos do galho', erro)
      })
    } else {
      construir()
    }
  }

  private reconstruirLinha(): void {
    this.lineGeometry.dispose()

    const positions = new Float32Array(this.rotulos.length * 6)
    for (let i = 0; i < this.rotulos.length; i++) {
      const r = this.rotulos[i]!
      // Ponta do galho: fixa, e derivada da própria âncora — o galho nunca
      // se move, então não há por que guardar a ponta duas vezes.
      positions[i * 6] = r.ancora.x
      positions[i * 6 + 1] = r.ancora.y - OFFSET
      positions[i * 6 + 2] = r.ancora.z
      positions[i * 6 + 3] = r.ancora.x
      positions[i * 6 + 4] = r.ancora.y
      positions[i * 6 + 5] = r.ancora.z
    }

    this.lineGeometry = new BufferGeometry()
    this.lineGeometry.setAttribute('position', new BufferAttribute(positions, 3))
    this.lines.geometry = this.lineGeometry
  }

  private limparRotulos(): void {
    for (const r of this.rotulos) {
      this.group.remove(r.sprite)
      r.texture.dispose()
      r.material.dispose()
    }
    this.rotulos = []
  }

  setVisible(v: boolean): void {
    this.group.visible = v
  }

  /** Acende um rótulo pelo slug, ou apaga todos com `null`. */
  setHighlight(slug: string | null): void {
    for (const r of this.rotulos) {
      r.alvo = r.slug === slug ? 1 : 0
    }
  }

  /** Id do galho de um post, pra quem quiser acender o mesmo galho no scan. */
  branchIdFor(slug: string | null): number | null {
    if (slug === null) return null
    return this.rotulos.find((r) => r.slug === slug)?.branchId ?? null
  }

  update(dt: number, elapsed: number, _camera: PerspectiveCamera): void {
    // Chamado sem condição em toda rota (`main.ts`), mas só `/blog` deixa o
    // grupo visível — em `/`, `/blog/:slug` e o 404 isto amortecia cor,
    // recomputava o bob e resubia um buffer da GPU todo frame por nada. O
    // amortecimento (`r.atual`) simplesmente pausa e retoma de onde parou
    // quando o grupo volta a ficar visível: nada consome o valor enquanto
    // escondido (`hitTest` só roda em `/blog`, e `setHighlight` já zera o
    // alvo antes do grupo sumir), então pausar não descola nada.
    if (!this.group.visible) return
    if (this.rotulos.length === 0) return

    const positions = this.lineGeometry.attributes['position'] as BufferAttribute

    for (let i = 0; i < this.rotulos.length; i++) {
      const r = this.rotulos[i]!
      r.atual = damp(r.atual, r.alvo, REALCE_LAMBDA, dt)
      r.material.color.copy(this.corRepouso).lerp(this.corAcesa, r.atual)

      // Duas frequências incomensuráveis nunca repetiriam o padrão juntas,
      // mas aqui um rótulo só tem uma — o deslocamento de fase por índice já
      // basta pra copa nunca respirar em uníssono.
      const bob = this.quality.reducedMotion ? 0 : Math.sin(elapsed * 0.6 + i) * BOB_AMPLITUDE
      r.sprite.position.set(r.ancora.x, r.ancora.y + bob, r.ancora.z)

      positions.setXYZ(i * 2 + 1, r.sprite.position.x, r.sprite.position.y, r.sprite.position.z)
    }

    positions.needsUpdate = true
  }

  /** Sprite mais próximo sob o raio, ou `null`. */
  hitTest(raycaster: Raycaster): string | null {
    if (this.rotulos.length === 0) return null
    const sprites = this.rotulos.map((r) => r.sprite)
    const hit = raycaster.intersectObjects(sprites, false)[0]
    return hit ? ((hit.object.userData['slug'] as string | undefined) ?? null) : null
  }

  dispose(): void {
    this.limparRotulos()
    this.lineGeometry.dispose()
    this.lineMaterial.dispose()
  }
}
