/**
 * A rota que não existe: nem slug de post, nem `/blog`, nem `/`.
 *
 * A câmera volta pra árvore inteira — o mesmo enquadramento do boot — porque
 * é o único lugar do site que sempre faz sentido mostrar, mesmo quando o
 * endereço não faz.
 */

import { Vector3 } from 'three'
import type { CameraRig } from '../../core/CameraRig'
import { buildPath, href } from '../../core/routes'
import type { BranchData } from '../../world/BranchSystem'
import type { Page } from '../PageHost'

/** Quanto tempo dura o voo de volta pra árvore inteira. */
const VOO_SEGUNDOS = 1.1

export class NotFoundPage implements Page {
  private root: HTMLElement | null = null

  constructor(
    private rig: CameraRig,
    private branches: BranchData,
  ) {}

  mount(root: HTMLElement): void {
    this.root = root

    const hero = document.createElement('header')
    hero.className = 'hero'
    hero.setAttribute('data-reveal', '')
    hero.innerHTML = `
      <h1>não achei esse texto</h1>
      <p class="lead">talvez ele ainda não exista, ou o endereço veio torto.</p>
      <p class="meta"><a class="voltar" href="${href(buildPath('blog'))}">← blog</a></p>
    `

    root.append(hero)

    this.rig.flyTo(
      new Vector3(0, this.branches.centreY, 0),
      this.branches.halfWidth,
      this.branches.halfHeight,
      VOO_SEGUNDOS,
    )
  }

  get panes(): HTMLElement[] {
    return this.root ? Array.from(this.root.querySelectorAll<HTMLElement>('.material')) : []
  }

  unmount(): void {
    this.root = null
  }
}
