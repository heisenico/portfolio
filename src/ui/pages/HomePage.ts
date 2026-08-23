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
 *
 * É a rota de volta: quem chega de /blog ou de um post encontra a câmera onde
 * a última rota a deixou, não em cima da árvore inteira. Voar de volta pro
 * enquadramento do boot (mesmas extensões que `main.ts` usa pra enquadrar no
 * carregamento) é o que faz `início` na navegação realmente voltar pra casa.
 */

import { Vector3 } from 'three'
import { aprendizado } from '../../content/aprendizado'
import { agruparPaixoes, paixoes } from '../../content/paixoes'
import { site } from '../../content/site'
import { sobre } from '../../content/sobre'
import type { CameraRig } from '../../core/CameraRig'
import type { BranchData } from '../../world/BranchSystem'
import type { Page } from '../PageHost'

/**
 * Quanto tempo dura o voo de volta pra árvore inteira. Mesma duração do 404,
 * que faz o mesmo voo pro mesmo enquadramento.
 */
const VOO_SEGUNDOS = 1.1

/** Emitido ao passar o mouse numa paixão; o tronco escuta. */
export interface PaixaoHoverDetail {
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
  private paixaoRows: HTMLElement[] = []

  constructor(
    private rig: CameraRig,
    private branches: BranchData,
  ) {}

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

    const grupos = agruparPaixoes(paixoes)
    let indice = 0
    const paixoesHtml = grupos
      .map(
        (grupo) => `
          <div class="grupo">
            <h3 class="grupo-rotulo">${esc(grupo.rotulo)}</h3>
            <ul class="paixoes">
              ${grupo.itens
                .map(
                  (p) => `
                    <li class="paixao" data-reveal="linha" data-paixao-index="${indice++}">
                      <span class="paixao-nome">${esc(p.nome)}</span>
                      ${p.nota ? `<span class="paixao-nota">${esc(p.nota)}</span>` : ''}
                    </li>`,
                )
                .join('')}
            </ul>
          </div>`,
      )
      .join('')

    sheet.innerHTML = `
      ${sobre.secoes
        .map(
          (secao) => `
        <section class="bloco" data-reveal aria-labelledby="sec-${secao.id}">
          <h2 id="sec-${secao.id}">${esc(secao.titulo)}</h2>
          <div class="prosa">${secao.corpo.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        </section>`,
        )
        .join('')}

      <section class="bloco" data-reveal aria-labelledby="sec-aprendendo">
        <h2 id="sec-aprendendo">aprendendo</h2>
        <dl class="agenda">
          <dt><span class="ponto is-agora" aria-hidden="true"></span>agora</dt>
          <dd>
            ${esc(aprendizado.agora.nome)}
            <span class="porque">${esc(aprendizado.agora.porque)}</span>
          </dd>
          <dt><span class="ponto" aria-hidden="true"></span>depois</dt>
          <dd>
            ${esc(aprendizado.depois.nome)}
            <span class="porque">${esc(aprendizado.depois.porque)}</span>
          </dd>
        </dl>

        ${paixoesHtml}
      </section>

      <section class="bloco" data-reveal aria-labelledby="sec-onde">
        <h2 id="sec-onde">onde me achar</h2>
        <ul class="links">
          ${links
            .map(
              (link) => `
            <li data-reveal="linha">
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

      <section class="bloco convite" data-reveal>
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

    this.rig.flyTo(
      new Vector3(0, this.branches.centreY, 0),
      this.branches.halfWidth,
      this.branches.halfHeight,
      VOO_SEGUNDOS,
    )

    this.paixaoRows = Array.from(root.querySelectorAll<HTMLElement>('.paixao'))
    for (const row of this.paixaoRows) {
      // Pointer only, deliberately. Acender o anel no tronco é decoração — o
      // nome já está ali como texto — então colocar estas linhas na ordem de
      // tabulação custaria uma parada de foco que não faz nada.
      row.addEventListener('pointerenter', this.onPaixaoEnter)
      row.addEventListener('pointerleave', this.onPaixaoLeave)
    }
  }

  private onPaixaoEnter = (event: Event): void => {
    const index = Number((event.currentTarget as HTMLElement).dataset['paixaoIndex'])
    this.emitPaixao(Number.isFinite(index) ? index : null)
  }

  private onPaixaoLeave = (): void => {
    this.emitPaixao(null)
  }

  private emitPaixao(index: number | null): void {
    document.dispatchEvent(
      new CustomEvent<PaixaoHoverDetail>('paixao-hover', { detail: { index } }),
    )
  }

  update(): void {
    // Nada por frame: PageHost cuida do parallax e do brilho do material.
  }

  get panes(): HTMLElement[] {
    return this.root ? Array.from(this.root.querySelectorAll<HTMLElement>('.material')) : []
  }

  unmount(): void {
    for (const row of this.paixaoRows) {
      row.removeEventListener('pointerenter', this.onPaixaoEnter)
      row.removeEventListener('pointerleave', this.onPaixaoLeave)
    }
    this.paixaoRows = []
    this.emitPaixao(null)
    this.root = null
  }
}
