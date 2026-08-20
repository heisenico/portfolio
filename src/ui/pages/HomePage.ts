/**
 * A página inicial: a árvore vista de fora, e a pessoa.
 *
 * A ordem das seções é uma decisão de produto, não de layout. Um site pessoal
 * responde, nesta ordem: quem é isso, o que faz, no que está metido, e como
 * falar com ele. O bloco de aprendizado fica entre "o que faço" e o convite,
 * porque uma pessoa visivelmente no meio de aprender alguma coisa *é* o convite.
 */

import { anosDe, aprendizado } from '../../content/aprendizado'
import { site } from '../../content/site'
import { sobre } from '../../content/sobre'
import type { Page } from '../PageHost'

/** Evento emitido ao passar o mouse numa habilidade; o tronco escuta. */
export interface SkillHoverDetail {
  index: number | null
}

/**
 * A cópia é nossa, não é entrada de usuário — mas ela vai ser editada à mão
 * muitas vezes, e um `<` perdido não deve virar marcação.
 */
function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export class HomePage implements Page {
  private root: HTMLElement | null = null
  private skillRows: HTMLElement[] = []

  mount(root: HTMLElement): void {
    this.root = root
    const { perfil, links, rodape } = site

    const hero = document.createElement('header')
    hero.className = 'hero'
    hero.innerHTML = `
      <p class="eyebrow">${esc(perfil.nome)}</p>
      <h1 class="manchete">${esc(sobre.manchete)}</h1>
      <p class="sub">${esc(sobre.sub)}</p>
      <div class="meta">
        <span>${esc(perfil.papel)}</span>
        <span>${esc(perfil.lugar)}</span>
        <span>${esc(perfil.empresa)}</span>
      </div>
    `

    const sections = sobre.secoes.map((secao, i) => {
      const el = document.createElement('section')
      el.className = 'secao'
      el.setAttribute('aria-labelledby', `sec-${secao.id}`)
      // Alternating depth so neighbouring panes never drift in lockstep.
      el.innerHTML = `
        <div class="secao-pane glass" style="--depth:${(1.6 + (i % 3) * 0.5).toFixed(2)}">
          <h2 id="sec-${secao.id}">${esc(secao.titulo)}</h2>
          ${secao.corpo.map((p) => `<p>${esc(p)}</p>`).join('')}
        </div>
      `
      return el
    })

    const aprender = document.createElement('section')
    aprender.className = 'secao aprendizado'
    aprender.setAttribute('aria-labelledby', 'sec-aprendizado')
    aprender.innerHTML = `
      <h2 id="sec-aprendizado" class="secao-titulo">Sempre aprendendo</h2>
      <div class="aprendendo-grid">
        <div class="aprendendo glass is-agora" style="--depth:2.1">
          <span class="quando">Agora</span>
          <h3>${esc(aprendizado.agora.nome)}</h3>
          <p>${esc(aprendizado.agora.porque)}</p>
        </div>
        <div class="aprendendo glass is-depois" style="--depth:1.7">
          <span class="quando">Depois</span>
          <h3>${esc(aprendizado.depois.nome)}</h3>
          <p>${esc(aprendizado.depois.porque)}</p>
        </div>
      </div>
      <h3 class="ja-titulo">Já aprendi</h3>
      <ul class="habilidades">
        ${aprendizado.jaAprendi
          .map((h, i) => {
            const anos = anosDe(h)
            return `
              <li class="habilidade" data-skill-index="${i}">
                <span class="hab-nome">${esc(h.nome)}</span>
                <span class="hab-rule" aria-hidden="true"></span>
                <span class="hab-anos">${anos} ${anos === 1 ? 'ano' : 'anos'}</span>
                <span class="hab-desde">desde ${h.desde}</span>
                ${h.nota ? `<span class="hab-nota">${esc(h.nota)}</span>` : ''}
              </li>`
          })
          .join('')}
      </ul>
    `

    const onde = document.createElement('section')
    onde.className = 'secao'
    onde.setAttribute('aria-labelledby', 'sec-onde')
    onde.innerHTML = `
      <h2 id="sec-onde" class="secao-titulo">Onde me achar</h2>
      <ul class="links">
        ${links
          .map(
            (link) => `
            <li>
              <a class="link glass" href="${link.href}"${
                link.href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''
              }>
                <span class="link-rotulo">${esc(link.rotulo)}</span>
                ${link.nota ? `<span class="link-nota">${esc(link.nota)}</span>` : ''}
              </a>
            </li>`,
          )
          .join('')}
      </ul>
    `

    const convite = document.createElement('section')
    convite.className = 'secao convite'
    convite.innerHTML = `
      <div class="convite-pane glass" style="--depth:2.4">
        <h2>${esc(sobre.convite.titulo)}</h2>
        <p>${esc(sobre.convite.corpo)}</p>
        <a class="convite-cta" href="mailto:nicholasferrer@hotmail.com">Me manda um e-mail</a>
      </div>
    `

    const foot = document.createElement('footer')
    foot.className = 'page-foot'
    foot.innerHTML = `<span>${esc(rodape.nota)}</span><span>${new Date().getFullYear()}</span>`

    root.append(hero, ...sections, aprender, onde, convite, foot)

    this.skillRows = Array.from(root.querySelectorAll<HTMLElement>('.habilidade'))
    for (const row of this.skillRows) {
      row.addEventListener('pointerenter', this.onSkillEnter)
      row.addEventListener('pointerleave', this.onSkillLeave)
      // Keyboard users get the same cross-link as the pointer does.
      row.tabIndex = 0
      row.addEventListener('focus', this.onSkillEnter)
      row.addEventListener('blur', this.onSkillLeave)
    }
  }

  private onSkillEnter = (event: Event): void => {
    const index = Number((event.currentTarget as HTMLElement).dataset['skillIndex'])
    this.emitSkill(Number.isFinite(index) ? index : null)
  }

  private onSkillLeave = (): void => {
    this.emitSkill(null)
  }

  private emitSkill(index: number | null): void {
    document.dispatchEvent(
      new CustomEvent<SkillHoverDetail>('skill-hover', { detail: { index } }),
    )
  }

  update(): void {
    // Nothing per-frame: PageHost owns the parallax and the glass sheen.
  }

  get panes(): HTMLElement[] {
    return this.root ? Array.from(this.root.querySelectorAll<HTMLElement>('.glass')) : []
  }

  unmount(): void {
    for (const row of this.skillRows) {
      row.removeEventListener('pointerenter', this.onSkillEnter)
      row.removeEventListener('pointerleave', this.onSkillLeave)
      row.removeEventListener('focus', this.onSkillEnter)
      row.removeEventListener('blur', this.onSkillLeave)
    }
    this.skillRows = []
    this.emitSkill(null)
    this.root = null
  }
}
