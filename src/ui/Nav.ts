/**
 * Pílula de navegação — início / blog.
 *
 * Montada fora de `#ui`, ao lado do canvas: a única coisa que muda entre
 * rotas aqui é qual segmento está aceso, e o indicador precisa deslizar com a
 * URL, não com a transição da página, ou ia piscar junto com ela a cada
 * navegação.
 */

import { buildPath, href, type RouteName } from '../core/routes'

/**
 * Qual segmento uma rota acende, se algum. Um post é alcançado voando a
 * partir de um galho dentro de `/blog`, então conta como blog aqui também;
 * `notFound` não reivindica nenhum dos dois — a pílula não deve afirmar que
 * você está numa página em que não está.
 */
export function activeIndex(name: RouteName): number | null {
  switch (name) {
    case 'home':
      return 0
    case 'blog':
    case 'post':
      return 1
    default:
      return null
  }
}

export class Nav {
  readonly el: HTMLElement
  private readonly thumb: HTMLSpanElement
  private readonly anchors: HTMLAnchorElement[]
  /** Última rota recebida, pra remedir o indicador depois que a webfont carregar. */
  private ultimaRota: RouteName | null = null

  constructor(nav: { home: string; blog: string }) {
    this.el = document.createElement('div')
    this.el.className = 'pilula'

    this.thumb = document.createElement('span')
    this.thumb.className = 'thumb is-oculta'
    this.el.appendChild(this.thumb)

    this.anchors = [
      this.criarLink(buildPath('home'), nav.home),
      this.criarLink(buildPath('blog'), nav.blog),
    ]

    // `--font-sans` troca de system-ui pra Geist com `font-display: swap`.
    // Se `setActive` já rodou com a métrica de reserva, o indicador fica
    // com tamanho/posição errados até a próxima navegação — remedir depois
    // que a fonte resolve corrige isso sem esperar uma troca de rota.
    // Mesma forma de `BranchLabels.ts` (`construirTextura` tem o mesmo
    // problema com a largura do texto).
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready
        .then(() => {
          if (this.ultimaRota) this.setActive(this.ultimaRota)
        })
        .catch((erro: unknown) => {
          // Falha alta, não silenciosa — contrato do projeto. O indicador
          // só fica com a métrica de reserva; não é fatal, mas precisa
          // aparecer no console pra ser notado.
          console.error('[portfolio] document.fonts.ready falhou pra remedir a pílula', erro)
        })
    }
  }

  private criarLink(path: string, rotulo: string): HTMLAnchorElement {
    const a = document.createElement('a')
    a.href = href(path)
    a.textContent = rotulo
    this.el.appendChild(a)
    return a
  }

  /**
   * Move o indicador com a rota — nunca com a transição de página, que corre
   * num ritmo diferente e às vezes nem acontece (recarregamento a frio de
   * `/blog/:slug`, por exemplo).
   */
  setActive(name: RouteName): void {
    this.ultimaRota = name
    const index = activeIndex(name)

    for (let i = 0; i < this.anchors.length; i++) {
      const anchor = this.anchors[i]
      if (!anchor) continue
      if (i === index) anchor.setAttribute('aria-current', 'page')
      else anchor.removeAttribute('aria-current')
    }

    const alvo = index === null ? undefined : this.anchors[index]
    if (!alvo) {
      this.thumb.classList.add('is-oculta')
      return
    }

    this.thumb.classList.remove('is-oculta')
    this.thumb.style.transform = `translateX(${alvo.offsetLeft}px)`
    this.thumb.style.width = `${alvo.offsetWidth}px`
  }

  dispose(): void {
    this.el.remove()
    this.el.replaceChildren()
  }
}
