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
/**
 * Prazo do reforço de segurança.
 *
 * Uma decoração nunca pode ser o único caminho de volta pro conteúdo visível.
 * No modo `js` o CSS zera a opacidade e só um callback do IntersectionObserver
 * a restaura — se esse callback nunca disparar (bug de engine, extensão,
 * política do navegador, um ambiente como o desta verificação), a página
 * inteira fica invisível pra sempre, sem texto e sem saída. 1200ms é tempo
 * suficiente pra um observer que funciona sempre vencer a corrida, e curto o
 * bastante pra um observer quebrado nunca deixar o leitor olhando pro vidro
 * em branco.
 */
const REFORCO_MS = 1200

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
  private reforco: ReturnType<typeof setTimeout> | null = null
  /** Alvos da página atual, pro reforço poder revelar todo mundo de uma vez. */
  private alvos: HTMLElement[] = []

  constructor(private mode: RevealMode) {
    if (mode === 'off') {
      document.documentElement.removeAttribute('data-reveal-mode')
      return
    }
    document.documentElement.setAttribute('data-reveal-mode', mode)

    // Guarda: sem isso, `new IntersectionObserver` lançaria com o atributo já
    // escrito, e a página ficaria em branco sem observer nenhum pra corrigir.
    // Sem o construtor, cai direto pro reforço em `observe()`.
    if (mode === 'js' && typeof IntersectionObserver !== 'undefined') {
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
    if (this.mode !== 'js') return

    // Troca de página: os alvos da página anterior nunca mais vão cruzar a
    // viewport (o nó já foi desmontado), e um observer que continua vigiando
    // elementos fora do DOM só acumula memória a cada navegação — sem isso,
    // Task 6 e 8 vazam um `[data-reveal]` inteiro por rota visitada.
    this.observer?.disconnect()
    if (this.reforco !== null) clearTimeout(this.reforco)

    const porPai = new Map<Element, number>()
    this.alvos = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    for (const el of this.alvos) {
      const pai = el.parentElement ?? root
      const i = porPai.get(pai) ?? 0
      porPai.set(pai, i + 1)
      el.style.setProperty('--i', String(Math.min(i, 8)))
      el.style.setProperty('--escalonamento', `${ESCALONAMENTO_MS}ms`)
      this.observer?.observe(el)
    }

    // Um temporizador só pro lote inteiro, não um por elemento: se o
    // observer nunca disparar, revela tudo de uma vez em vez de escalonar uma
    // falha.
    this.reforco = setTimeout(() => {
      for (const el of this.alvos) el.classList.add('is-in')
      this.observer?.disconnect()
      this.reforco = null
    }, REFORCO_MS)
  }

  dispose(): void {
    this.observer?.disconnect()
    this.observer = null
    if (this.reforco !== null) {
      clearTimeout(this.reforco)
      this.reforco = null
    }
    this.alvos = []
  }
}
