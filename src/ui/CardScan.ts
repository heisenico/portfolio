/**
 * Triggers the per-card scan-in.
 *
 * Cards start hidden in CSS, so if this never runs the content would be
 * invisible — an `IntersectionObserver` alone is not enough, because a card
 * that is already on screen at load, or a browser without the observer, would
 * never fire. Both cases fall through to `revealAll`.
 */

const STAGGER_MS = 110

export class CardScan {
  private observer: IntersectionObserver | undefined
  private order = new Map<Element, number>()
  private revealed = new WeakSet<Element>()

  constructor(private cards: HTMLElement[]) {
    for (const card of cards) this.decorate(card)

    if (typeof IntersectionObserver === 'undefined') {
      this.revealAll()
      return
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          this.reveal(entry.target as HTMLElement)
          this.observer?.unobserve(entry.target)
        }
      },
      { threshold: 0.25, rootMargin: '0px 0px -8% 0px' },
    )
  }

  /** Insert the scan chrome. Kept out of `Cards` so the markup stays readable. */
  private decorate(card: HTMLElement): void {
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    border.setAttribute('class', 'scan-border')
    border.setAttribute('aria-hidden', 'true')
    border.setAttribute('preserveAspectRatio', 'none')

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    // pathLength normalises the perimeter to 100 regardless of the card's real
    // size, so one dash length animates every card identically.
    rect.setAttribute('pathLength', '100')
    // Percentage geometry attributes are universally supported; calc() in an
    // SVG geometry attribute is not. The stroke straddles the edge, and the
    // svg is overflow:visible, so nothing clips.
    rect.setAttribute('width', '100%')
    rect.setAttribute('height', '100%')
    rect.setAttribute('rx', '20')
    border.appendChild(rect)

    const line = document.createElement('span')
    line.className = 'scan-line'
    line.setAttribute('aria-hidden', 'true')

    card.prepend(border)
    card.prepend(line)
  }

  /** Begin observing. Cards already on screen are revealed immediately. */
  start(): void {
    this.cards.forEach((card, i) => this.order.set(card, i))

    if (!this.observer) {
      this.revealAll()
      return
    }

    for (const card of this.cards) {
      const rect = card.getBoundingClientRect()
      const onScreen = rect.top < window.innerHeight && rect.bottom > 0
      if (onScreen) {
        this.reveal(card)
      } else {
        this.observer.observe(card)
      }
    }
  }

  private reveal(card: HTMLElement): void {
    if (this.revealed.has(card)) return
    this.revealed.add(card)

    // Stagger within the batch that becomes visible together.
    const index = this.order.get(card) ?? 0
    const batchIndex = index % 4
    card.style.setProperty('--scan-delay', `${batchIndex * STAGGER_MS}ms`)
    card.classList.add('is-scanning')
  }

  revealAll(): void {
    for (const card of this.cards) this.reveal(card)
  }

  dispose(): void {
    this.observer?.disconnect()
  }
}
