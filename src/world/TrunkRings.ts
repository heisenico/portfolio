/**
 * Anéis no tronco — um por ano de cada habilidade.
 *
 * Uma árvore guarda os anos dela em anéis, e ele também. Cada habilidade vira
 * uma faixa de círculos empilhados no tronco: um círculo por ano. Surf desde
 * 2014 é uma faixa grossa; yoga desde 2024 é um par de fios. A leitura é
 * imediata e não precisa de legenda — a espessura *é* o tempo.
 *
 * As faixas sobem em ordem cronológica: a mais antiga embaixo.
 *
 * Passar o mouse na habilidade na página acende o anel dela no mundo.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
} from 'three'
import { anosDe, type Habilidade } from '../content/aprendizado'
import { clamp01, damp } from '../util/tween'

/** Segments per circle. Low enough to stay cheap, high enough to read round. */
const SEGMENTS = 72
/**
 * Rings hug the trunk at a constant radius and stack *vertically*, one per
 * year. Growing them concentrically instead made a twelve-year skill merge
 * into a solid disc floating around the trunk — a halo, not rings.
 */
const RING_RADIUS = 0.86
const YEAR_RISE = 0.17
/** Gap between one skill's band and the next. */
const BAND_GAP = 0.62
/** Where the oldest skill starts, just above the roots. */
const FIRST_HEIGHT = -1.9

const REST_OPACITY = 0.3
const LIT_OPACITY = 0.9

export class TrunkRings {
  readonly group = new Group()

  private materials: LineBasicMaterial[] = []
  private targets: number[] = []
  private current: number[] = []
  private restColor = new Color(0x4fe08f)
  private litColor = new Color(0xd9ffe9)
  private highlighted: number | null = null

  constructor(skills: Habilidade[], hoje = new Date()) {
    let cursorY = FIRST_HEIGHT

    skills.forEach((skill) => {
      const anos = anosDe(skill, hoje)
      if (skill.desde === 0 || anos <= 0) {
        // A sentinel year must never reach the screen: a ring drawn from a
        // placeholder would silently claim something untrue about a person.
        throw new Error(`TrunkRings: "${skill.nome}" precisa de um ano real em "desde"`)
      }

      const material = new LineBasicMaterial({
        color: this.restColor.clone(),
        transparent: true,
        opacity: REST_OPACITY,
        depthWrite: false,
        blending: AdditiveBlending,
      })
      this.materials.push(material)
      this.targets.push(REST_OPACITY)
      this.current.push(REST_OPACITY)

      const band = new Group()
      band.position.y = cursorY

      for (let year = 0; year < anos; year++) {
        const ring = new LineLoop(circleGeometry(RING_RADIUS), material)
        ring.rotation.x = Math.PI / 2
        ring.position.y = year * YEAR_RISE
        band.add(ring)
      }

      // Stack the next skill above this one, so the trunk reads bottom-up in
      // chronological order.
      cursorY += anos * YEAR_RISE + BAND_GAP
      this.group.add(band)
    })

    this.group.frustumCulled = false
  }

  /** Light one skill's band, or `null` to clear. */
  setHighlight(index: number | null): void {
    this.highlighted = index
    for (let i = 0; i < this.targets.length; i++) {
      this.targets[i] = index === i ? LIT_OPACITY : REST_OPACITY
    }
  }

  /**
   * @param reveal 0..1 across the intro sweep — the rings arrive with the tree
   *        rather than being there before it exists.
   */
  update(dt: number, elapsed: number, reveal: number): void {
    const gate = clamp01((reveal - 0.35) / 0.4)

    for (let i = 0; i < this.materials.length; i++) {
      const material = this.materials[i]!
      this.current[i] = damp(this.current[i]!, this.targets[i]!, 9, dt)

      // A slow breath, phase-offset per band so they never pulse in unison.
      const breath = 1 + Math.sin(elapsed * 0.7 + i * 1.9) * 0.08
      material.opacity = this.current[i]! * gate * breath

      const lit = this.highlighted === i ? 1 : 0
      material.color.copy(this.restColor).lerp(this.litColor, lit * 0.85)
    }
  }

  dispose(): void {
    this.group.traverse((object) => {
      const line = object as Partial<LineLoop>
      line.geometry?.dispose()
    })
    for (const material of this.materials) material.dispose()
  }
}

/** A flat circle in the XY plane; the caller rotates it onto the trunk. */
function circleGeometry(radius: number): BufferGeometry {
  const points = new Float32Array(SEGMENTS * 3)
  for (let i = 0; i < SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * Math.PI * 2
    points[i * 3] = Math.cos(angle) * radius
    points[i * 3 + 1] = Math.sin(angle) * radius
    points[i * 3 + 2] = 0
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(points, 3))
  return geometry
}
