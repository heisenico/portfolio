/**
 * A página inicial.
 *
 * Uma coluna só, estreita, em cima do mundo. A versão anterior espalhava doze
 * painéis de vidro alternando de lado; era muita moldura pra pouca informação,
 * e a moldura competia com a árvore atrás. Agora existe uma superfície só, e
 * ela existe por um motivo funcional: segurar a leitura em cima de uma cena
 * que se mexe.
 *
 * A ordem responde, nesta sequência: quem é, o que faz, o que está aprendendo,
 * onde encontrar. O bloco de aprendizado fica no meio porque é a parte que
 * muda com o tempo — é o que faz o site valer uma segunda visita.
 */

import { anosDe, aprendizado } from '../../content/aprendizado'
import { site } from '../../content/site'
import { sobre } from '../../content/sobre'
import type { Page } from '../PageHost'

/** Emitido ao passar o mouse numa habilidade; o tronco escuta. */
export interface SkillHoverDetail {
  index: number | null
}

/**
 * A cópia é nossa, não é entrada de usuário — mas vai ser editada à mão muitas
 * vezes, e um `<` perdido não deve virar marcação.
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
      <h1>${esc(perfil.nome)}</h1>
      <p class="lead">${esc(sobre.lead)}</p>
      <p class="meta">
        <span>${esc(perfil.papel)}</span>
        <span>${esc(perfil.lugar)}</span>
      </p>
    `

    const sheet = document.createElement('div')
    sheet.className = 'folha material'

    sheet.innerHTML = `
      ${sobre.secoes
        .map(
          (secao) => `
        <section class="bloco" aria-labelledby="sec-${secao.id}">
          <h2 id="sec-${secao.id}">${esc(secao.titulo)}</h2>
          <div class="prosa">${secao.corpo.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        </section>`,
        )
        .join('')}

      <section class="bloco" aria-labelledby="sec-aprendendo">
        <h2 id="sec-aprendendo">Aprendendo</h2>
        <dl class="agenda">
          <dt><span class="ponto is-agora" aria-hidden="true"></span>Agora</dt>
          <dd>
            ${esc(aprendizado.agora.nome)}
            <span class="porque">${esc(aprendizado.agora.porque)}</span>
          </dd>
          <dt><span class="ponto" aria-hidden="true"></span>Depois</dt>
          <dd>
            ${esc(aprendizado.depois.nome)}
            <span class="porque">${esc(aprendizado.depois.porque)}</span>
          </dd>
        </dl>

        <ul class="habilidades">
          ${aprendizado.jaAprendi
            .map((h, i) => {
              const anos = anosDe(h)
              return `
                <li class="habilidade" data-skill-index="${i}">
                  <span class="hab-nome">${esc(h.nome)}</span>
                  <span class="hab-anos">${anos} ${anos === 1 ? 'ano' : 'anos'}</span>
                </li>`
            })
            .join('')}
        </ul>
      </section>

      <section class="bloco" aria-labelledby="sec-onde">
        <h2 id="sec-onde">Onde me achar</h2>
        <ul class="links">
          ${links
            .map(
              (link) => `
            <li>
              <a href="${link.href}"${
                link.href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''
              }>
                <span class="link-rotulo">${esc(link.rotulo)}</span>
                ${link.nota ? `<span class="link-nota">${esc(link.nota)}</span>` : ''}
              </a>
            </li>`,
            )
            .join('')}
        </ul>
      </section>

      <section class="bloco convite">
        <p>${esc(sobre.convite)}
          <a href="mailto:nicholasferrer@hotmail.com">nicholasferrer@hotmail.com</a>
        </p>
      </section>
    `

    const wrap = document.createElement('div')
    wrap.className = 'coluna'
    wrap.appendChild(sheet)

    const foot = document.createElement('footer')
    foot.className = 'page-foot'
    foot.innerHTML = `<span>${esc(rodape.nota)}</span><span>${new Date().getFullYear()}</span>`

    root.append(hero, wrap, foot)

    this.skillRows = Array.from(root.querySelectorAll<HTMLElement>('.habilidade'))
    for (const row of this.skillRows) {
      // Pointer only, deliberately. Acender o anel no tronco é decoração — o
      // nome e os anos já estão ali como texto — então colocar estas linhas na
      // ordem de tabulação custaria três paradas de foco que não fazem nada.
      row.addEventListener('pointerenter', this.onSkillEnter)
      row.addEventListener('pointerleave', this.onSkillLeave)
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
    document.dispatchEvent(new CustomEvent<SkillHoverDetail>('skill-hover', { detail: { index } }))
  }

  update(): void {
    // Nada por frame: PageHost cuida do parallax e do brilho do material.
  }

  get panes(): HTMLElement[] {
    return this.root ? Array.from(this.root.querySelectorAll<HTMLElement>('.material')) : []
  }

  unmount(): void {
    for (const row of this.skillRows) {
      row.removeEventListener('pointerenter', this.onSkillEnter)
      row.removeEventListener('pointerleave', this.onSkillLeave)
    }
    this.skillRows = []
    this.emitSkill(null)
    this.root = null
  }
}
