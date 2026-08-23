/**
 * O post. A câmera voa pro galho do texto, o leitor lê, e a rolagem é o
 * relógio do mundo que cresce por trás — nada anima sozinho.
 *
 * `post.html` é confiável: compilado em build a partir de um arquivo deste
 * repositório, nunca de entrada de usuário. Vai com `innerHTML` porque é isso
 * que é — marcação pronta. O resto da cópia é nossa, mas título de post é
 * editado à mão, e um `<` perdido não deve virar marcação.
 */

import type { PerspectiveCamera, Scene } from 'three'
import type { Post } from 'virtual:posts'
import type { CameraRig } from '../../core/CameraRig'
import type { Quality } from '../../core/Quality'
import { buildPath, href } from '../../core/routes'
import { clamp01 } from '../../util/tween'
import type { BranchLabels, PostBranch } from '../../world/BranchLabels'
import { loadPostWorld, type PostWorldModule } from '../../world/PostWorld'
import type { Page } from '../PageHost'

/** Quanto tempo dura o voo até o galho do post. */
const VOO_SEGUNDOS = 1.3

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Quanto do artigo já passou pelos olhos, de 0 a 1.
 *
 * Medido pelo artigo e não pelo documento: o rodapé e a folga de baixo não
 * são texto, e contá-los faria o mundo terminar de crescer antes da última
 * frase. É este número, e só ele, que move o mundo do post — ver o contrato,
 * item 5.
 */
export function readingProgress(
  scrollY: number,
  topo: number,
  altura: number,
  viewport: number,
): number {
  const curso = altura - viewport
  // Artigo que cabe na tela não tem curso. Devolver 0 deixaria o mundo pela
  // metade pra sempre; devolver 1 entrega ele inteiro, que é o certo quando
  // não sobrou nada pra revelar.
  if (curso <= 0) return 1
  return clamp01((scrollY - topo) / curso)
}

export class PostPage implements Page {
  private root: HTMLElement | null = null
  private articleEl: HTMLElement | null = null
  private world: PostWorldModule | null = null
  /** Falso a partir de `unmount()` — a escada de saída pro carregamento assíncrono. */
  private live = false
  private elapsed = 0
  private topo = 0
  private altura = 0
  private rectDirty = true
  private prevTitle = ''
  private prevDescription = ''

  constructor(
    private post: Post,
    private assignment: PostBranch,
    private rig: CameraRig,
    private labels: BranchLabels,
    private scene: Scene,
    private camera: PerspectiveCamera,
    private quality: Quality,
  ) {}

  mount(root: HTMLElement): void {
    this.root = root
    this.live = true

    const progresso = document.createElement('div')
    progresso.className = 'leitura-progresso'
    progresso.setAttribute('aria-hidden', 'true')

    const article = document.createElement('article')
    // `coluna-leitura` dá a folga de baixo que faz o artigo ter curso de
    // rolagem mesmo quando o texto é curto — ver `readingProgress`.
    article.className = 'leitura material coluna-leitura'
    article.setAttribute('data-reveal', '')

    const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${this.post.data}T12:00:00`))

    article.innerHTML = `
      <a class="voltar" href="${href(buildPath('blog'))}">← blog</a>
      <p class="carimbo"><time datetime="${esc(this.post.data)}">${esc(dataFormatada)}</time> · ${this.post.minutos} min</p>
      <h1>${esc(this.post.titulo)}</h1>
      <div class="prosa-post">${this.post.html}</div>
    `

    root.append(progresso, article)
    this.articleEl = article

    this.prevTitle = document.title
    document.title = this.post.titulo
    const metaDescricao = document.querySelector('meta[name="description"]')
    this.prevDescription = metaDescricao?.getAttribute('content') ?? ''
    metaDescricao?.setAttribute('content', this.post.resumo)

    this.rig.flyAlongBranch(this.assignment.branch, VOO_SEGUNDOS)
    this.labels.setVisible(false)

    window.addEventListener('resize', this.onResize, { passive: true })

    // Não aguardado de propósito: `mount` é síncrono no contrato de `Page`.
    // `montarMundo` confere `this.live` antes de tocar a cena, pro caso do
    // leitor sair da página antes do import dinâmico resolver.
    void this.montarMundo(root)
  }

  private onResize = (): void => {
    this.rectDirty = true
  }

  /**
   * Um mundo à mão (`content/worlds/<slug>.ts`) pode jogar tanto no import
   * dinâmico quanto em `build()`. Um throw sem captura aqui vira uma rejeição
   * não tratada no console, bem no caminho normal de carregar um post — e o
   * contrato de release é zero erro de console no load. A falha custa o
   * mundo, não a página: o artigo já está montado e continua legível.
   */
  private async montarMundo(overlay: HTMLElement): Promise<void> {
    let world: PostWorldModule | null = null
    try {
      world = await loadPostWorld(this.post)
      if (!this.live) return

      world.build({
        scene: this.scene,
        camera: this.camera,
        branch: this.assignment.branch,
        post: this.post,
        quality: this.quality,
        rig: this.rig,
        overlay,
      })
      this.world = world
    } catch (erro) {
      console.error(`[portfolio] mundo do post "${this.post.slug}" falhou ao montar`, erro)
      if (world) {
        try {
          // Se `build()` foi quem jogou, pode ter deixado algo atado à cena
          // pela metade — e o próprio `dispose()` de um mundo que não
          // terminou de nascer pode falhar também.
          world.dispose()
        } catch (erroDispose) {
          console.error(
            `[portfolio] mundo do post "${this.post.slug}" falhou até ao desfazer`,
            erroDispose,
          )
        }
      }
    }
  }

  update(dt: number): void {
    if (!this.articleEl) return

    this.elapsed += dt

    if (this.rectDirty) {
      this.topo = this.articleEl.offsetTop
      this.altura = this.articleEl.offsetHeight
      this.rectDirty = false
    }

    const progress = readingProgress(window.scrollY, this.topo, this.altura, window.innerHeight)
    this.world?.update(dt, this.elapsed, progress)
  }

  get panes(): HTMLElement[] {
    return this.root ? Array.from(this.root.querySelectorAll<HTMLElement>('.material')) : []
  }

  unmount(): void {
    this.live = false
    window.removeEventListener('resize', this.onResize)

    this.world?.dispose()
    this.world = null

    document.title = this.prevTitle
    document.querySelector('meta[name="description"]')?.setAttribute('content', this.prevDescription)

    // Sempre falso: quem decide se a copa volta a aparecer é a próxima
    // página, não esta — mais simples e sem risco de piscar rótulos numa
    // rota que não é o blog.
    this.labels.setVisible(false)

    this.root = null
    this.articleEl = null
  }
}
