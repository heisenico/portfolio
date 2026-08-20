/**
 * The content layer.
 *
 * Builds the page from `content.ts` and couples it to the world: cards drift
 * with the camera's orbit by a depth-scaled offset, and each pane's specular
 * sheen tracks the pointer across its own surface.
 *
 * Rects are cached and only recomputed when layout could have changed. Reading
 * `getBoundingClientRect` for every card every frame would force a layout flush
 * in the middle of the render loop.
 */

import { content } from '../content'
import type { Pointer } from '../core/Pointer'

/** Horizontal drift of the content layer, in pixels, at full pointer deflection. */
const PARALLAX_X = 26
const PARALLAX_Y = 14

export class Cards {
  readonly root: HTMLElement
  readonly cards: HTMLElement[] = []
  readonly panes: HTMLElement[] = []

  private rects: DOMRect[] = []
  private rectsDirty = true
  private cue: HTMLElement | null = null
  private cueHidden = false

  constructor(root: HTMLElement) {
    this.root = root
    this.build()
    this.panes = Array.from(root.querySelectorAll<HTMLElement>('.glass'))
    this.cards = Array.from(root.querySelectorAll<HTMLElement>('.card'))

    addEventListener('resize', this.markDirty, { passive: true })
    addEventListener('scroll', this.onScroll, { passive: true })
  }

  private markDirty = (): void => {
    this.rectsDirty = true
  }

  private onScroll = (): void => {
    this.rectsDirty = true
    if (!this.cueHidden && window.scrollY > 40) {
      this.cueHidden = true
      this.cue?.classList.add('is-gone')
    }
  }

  private build(): void {
    const { identity, projects, links, sectionTitles, footer } = content

    const hero = document.createElement('header')
    hero.className = 'hero'
    hero.innerHTML = `
      <p class="eyebrow">${identity.eyebrow}</p>
      <h1>${identity.name}</h1>
      <p class="role">${identity.role}</p>
      <p class="blurb">${identity.blurb}</p>
      <div class="meta"><span>${identity.location}</span><span>Available for work</span></div>
    `

    const work = document.createElement('section')
    work.className = 'section'
    work.setAttribute('aria-labelledby', 'work-title')
    work.innerHTML = `
      <div class="section-head">
        <h2 id="work-title">${sectionTitles.work}</h2>
        <div class="rule"></div>
        <span class="count">${String(projects.length).padStart(2, '0')}</span>
      </div>
      <ul class="cards">
        ${projects
          .map((project, i) => {
            const tags = project.tags.map((t) => `<li>${t}</li>`).join('')
            const metric = project.metric
              ? `<div class="card-metric">
                   <span class="value">${project.metric.value}</span>
                   <span class="label">${project.metric.label}</span>
                 </div>`
              : ''
            // Alternating depth so neighbouring cards never drift in lockstep.
            const depth = (1.9 + (i % 3) * 0.55).toFixed(2)
            return `
              <li>
                <article class="card glass" tabindex="0" style="--depth:${depth}">
                  <div class="card-top">
                    <span class="card-index">${project.index}</span>
                    <span>${project.year}</span>
                  </div>
                  <h3>${project.title}</h3>
                  <p>${project.summary}</p>
                  ${metric}
                  <ul class="tags">${tags}</ul>
                </article>
              </li>`
          })
          .join('')}
      </ul>
    `

    const contact = document.createElement('section')
    contact.className = 'section'
    contact.setAttribute('aria-labelledby', 'contact-title')
    contact.innerHTML = `
      <div class="section-head">
        <h2 id="contact-title">${sectionTitles.contact}</h2>
        <div class="rule"></div>
      </div>
      <ul class="links">
        ${links
          .map(
            (link) =>
              `<li><a class="link glass" href="${link.href}"${
                link.href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''
              }>${link.label}</a></li>`,
          )
          .join('')}
      </ul>
    `

    const foot = document.createElement('footer')
    foot.className = 'page-foot'
    foot.innerHTML = `<span>${footer.note}</span><span>${new Date().getFullYear()}</span>`

    const cue = document.createElement('div')
    cue.className = 'cue'
    cue.setAttribute('aria-hidden', 'true')
    cue.textContent = 'Scroll'
    this.cue = cue

    this.root.append(hero, work, contact, foot)
    document.body.append(cue)
  }

  private refreshRects(): void {
    this.rects = this.panes.map((el) => el.getBoundingClientRect())
    this.rectsDirty = false
  }

  update(_dt: number, pointer: Pointer): void {
    // Content drifts against the camera's orbit, so it feels attached to the
    // world rather than pasted on top of it.
    const x = -pointer.smooth.x * PARALLAX_X
    const y = pointer.smooth.y * PARALLAX_Y
    this.root.style.setProperty('--parallax-x', `${x.toFixed(2)}px`)
    this.root.style.setProperty('--parallax-y', `${y.toFixed(2)}px`)

    if (this.rectsDirty) this.refreshRects()

    const px = (pointer.ndc.x * 0.5 + 0.5) * window.innerWidth
    const py = (-pointer.ndc.y * 0.5 + 0.5) * window.innerHeight

    for (let i = 0; i < this.panes.length; i++) {
      const rect = this.rects[i]
      const pane = this.panes[i]
      if (!rect || !pane) continue
      // Skip panes that are off screen; their sheen is not visible anyway.
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue

      const mx = ((px - rect.left) / rect.width) * 100
      const my = ((py - rect.top) / rect.height) * 100
      pane.style.setProperty('--mx', `${mx.toFixed(1)}%`)
      pane.style.setProperty('--my', `${my.toFixed(1)}%`)
    }
  }

  /** 0 at the top of the page, 1 at the bottom. */
  get scrollProgress(): number {
    const max = document.documentElement.scrollHeight - window.innerHeight
    return max <= 0 ? 0 : Math.min(window.scrollY / max, 1)
  }

  dispose(): void {
    removeEventListener('resize', this.markDirty)
    removeEventListener('scroll', this.onScroll)
  }
}
