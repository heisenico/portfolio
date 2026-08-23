/**
 * O blog. Não existe lista de cards — a árvore é o índice: a câmera voa pra
 * dentro da copa e cada post pendura num galho dela, com um rótulo.
 *
 * A lista abaixo é reserva, não decoração: é o que um leitor de teclado, um
 * leitor de tela e um crawler realmente usam. O mundo é a interface
 * principal, mas nunca a única.
 */

import { Vector3 } from 'three'
import type { Post } from 'virtual:posts'
import type { CameraRig } from '../../core/CameraRig'
import { buildPath, href } from '../../core/routes'
import type { BranchLabels } from '../../world/BranchLabels'
import type { Page } from '../PageHost'

/**
 * A cópia é nossa, não é entrada de usuário — mas título de post é editado à
 * mão, e um `<` perdido não deve virar marcação.
 */
function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Enquadramento da copa: medido de `generateBranches({ origin: (0,6.5,0),
 * depth: 6 })`, não adivinhado. A árvore inteira tem centreY≈6.96,
 * halfWidth≈10.47, halfHeight≈9.40; os galhos de profundidade 2..4 — onde os
 * rótulos moram — ficam entre y≈5.6 e y≈14.0. `CANOPY_Y` mira o meio dessa
 * faixa, e as meia-extensões são ~55% das da árvore inteira, o suficiente pra
 * fechar o plano na copa sem cortar a ponta de nenhum galho escolhido.
 */
const CANOPY_Y = 10.4
const CANOPY_HALF_WIDTH = 5.8
const CANOPY_HALF_HEIGHT = 5.2
const CANOPY_FLIGHT_SECONDS = 1.1

export class BlogPage implements Page {
  private root: HTMLElement | null = null

  constructor(
    private rig: CameraRig,
    private labels: BranchLabels,
    private posts: Post[],
  ) {}

  mount(root: HTMLElement): void {
    this.root = root

    const hero = document.createElement('header')
    hero.className = 'hero'
    hero.innerHTML = `
      <h1>blog</h1>
      <p class="lead">cada texto é um galho. escolha um.</p>
    `

    const wrap = document.createElement('div')
    wrap.className = 'coluna'

    const nav = document.createElement('nav')
    nav.className = 'folha material'
    nav.setAttribute('aria-label', 'lista de textos')
    nav.innerHTML = `
      <ul class="galhos">
        ${this.posts
          .map(
            (post) => `
          <li data-reveal="linha">
            <a href="${href(buildPath('post', { slug: post.slug }))}">
              <span class="galho-titulo">${esc(post.titulo)}</span>
              <span class="galho-meta">${esc(post.data)} · ${post.minutos} min</span>
            </a>
          </li>`,
          )
          .join('')}
      </ul>
    `
    wrap.appendChild(nav)

    root.append(hero, wrap)

    this.rig.flyTo(
      new Vector3(0, CANOPY_Y, 0),
      CANOPY_HALF_WIDTH,
      CANOPY_HALF_HEIGHT,
      CANOPY_FLIGHT_SECONDS,
    )
    this.labels.setVisible(true)
  }

  get panes(): HTMLElement[] {
    return this.root ? Array.from(this.root.querySelectorAll<HTMLElement>('.material')) : []
  }

  unmount(): void {
    this.labels.setVisible(false)
    this.labels.setHighlight(null)
    this.root = null
  }
}
