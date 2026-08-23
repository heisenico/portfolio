/**
 * Entrada dos blocos conforme o leitor desce.
 *
 * O caminho bom é CSS puro: `animation-timeline: view()` dá a cada elemento a
 * própria passagem pela viewport como linha do tempo, roda no compositor e não
 * precisa de um único listener de scroll. Chromium e Safari recente têm;
 * Firefox ainda não.
 *
 * Por isso a detecção acontece uma vez, aqui, e vira um atributo no `<html>`.
 * O CSS tem dois ramos pendurados nesse atributo e mais nada — um `@supports`
 * cobriria o ramo nativo mas não o observer, e duas detecções que podem
 * discordar é pior que uma.
 *
 * Terceiro modo: `off`. Movimento reduzido não ganha versão suave da
 * animação, ganha ausência dela — nenhum atributo é escrito, nenhuma regra
 * casa, o conteúdo simplesmente está lá.
 */

export type RevealMode = 'css' | 'js' | 'off'

/** Distância antes da borda inferior em que um bloco começa a entrar. */
const MARGEM = '0px 0px -12% 0px'
/** Atraso entre irmãos, no modo de reserva. O nativo escalona sozinho. */
const ESCALONAMENTO_MS = 55

export function detectRevealMode(reducedMotion: boolean): RevealMode {
  if (reducedMotion) return 'off'
  const suporta =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline', 'view()')
  return suporta ? 'css' : 'js'
}

export class Reveal {
  private observer: IntersectionObserver | null = null

  constructor(private mode: RevealMode) {
    if (mode === 'off') {
      document.documentElement.removeAttribute('data-reveal-mode')
      return
    }
    document.documentElement.setAttribute('data-reveal-mode', mode)

    if (mode === 'js') {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            entry.target.classList.add('is-in')
            // Uma vez só. Um bloco que reaparece já foi lido; repetir a
            // entrada faria a página piscar na rolagem pra cima.
            this.observer?.unobserve(entry.target)
          }
        },
        { rootMargin: MARGEM, threshold: 0.05 },
      )
    }
  }

  /** Registra tudo que a página recém-montada marcou com `data-reveal`. */
  observe(root: HTMLElement): void {
    if (this.mode !== 'js' || !this.observer) return

    // O escalonamento é por vizinhança: irmãos entram em cascata, blocos
    // distantes não herdam o atraso de uma lista que ficou pra trás.
    const porPai = new Map<Element, number>()
    for (const el of root.querySelectorAll<HTMLElement>('[data-reveal]')) {
      const pai = el.parentElement ?? root
      const i = porPai.get(pai) ?? 0
      porPai.set(pai, i + 1)
      el.style.setProperty('--i', String(Math.min(i, 8)))
      el.style.setProperty('--escalonamento', `${ESCALONAMENTO_MS}ms`)
      this.observer.observe(el)
    }
  }

  dispose(): void {
    this.observer?.disconnect()
    this.observer = null
  }
}
