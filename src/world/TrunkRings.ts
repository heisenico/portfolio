/**
 * Anéis no tronco — um por paixão, agrupados por categoria.
 *
 * A versão anterior desenhava um círculo por ano, e o tronco virava um gráfico
 * de barras vertical: doze anos de surf eram uma faixa grossa, um ano de yoga
 * era um fio. Tirar os anos tira essa base, e o anel passa a ser uma coisa
 * contável em vez de medida — uma paixão, um anel.
 *
 * As bandas sobem na ordem de `CATEGORIAS`, com um vão maior entre bandas do
 * que entre anéis. É esse vão que faz a pilha ter forma.
 *
 * Passar o mouse na paixão na página acende o anel dela no mundo. É o único
 * elo direto entre o DOM e a cena, e existe pra que a página e o mundo sejam
 * duas vistas do mesmo fato em vez de duas camadas empilhadas.
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
import { alturasDosAneis, type Grupo } from '../content/paixoes'
import { clamp01, damp } from '../util/tween'

/** Segments per circle. Low enough to stay cheap, high enough to read round. */
const SEGMENTS = 72
const RING_RADIUS = 0.86
/** Trecho do tronco que os anéis ocupam, seja qual for a contagem. */
const DE = -1.9
const ATE = 1.3
/** O vão entre bandas vale este tanto de passo de anel. */
const FOLGA = 2.2

const REST_OPACITY = 0.3
const LIT_OPACITY = 0.9

export class TrunkRings {
  readonly group = new Group()

  private materials: LineBasicMaterial[] = []
  private targets: number[] = []
  private current: number[] = []
  private geometry = circleGeometry(RING_RADIUS)
  private restColor = new Color(0x4fe08f)
  private litColor = new Color(0xd9ffe9)
  private highlighted: number | null = null

  constructor(grupos: Grupo[]) {
    const alturas = alturasDosAneis(
      grupos.map((g) => g.itens.length),
      DE,
      ATE,
      FOLGA,
    )

    grupos.forEach((grupo, g) => {
      grupo.itens.forEach((_paixao, i) => {
        // Um material por anel: o realce é por paixão, não por banda.
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

        const ring = new LineLoop(this.geometry, material)
        ring.rotation.x = Math.PI / 2
        ring.position.y = alturas[g]![i]!
        this.group.add(ring)
      })
    })

    this.group.frustumCulled = false
  }

  /** Acende uma paixão pelo índice achatado, ou `null` pra apagar tudo. */
  setHighlight(index: number | null): void {
    this.highlighted = index
    for (let i = 0; i < this.targets.length; i++) {
      this.targets[i] = index === i ? LIT_OPACITY : REST_OPACITY
    }
  }

  /**
   * @param reveal 0..1 ao longo da varredura de entrada — os anéis chegam com
   *        a árvore em vez de estarem lá antes dela existir.
   */
  update(dt: number, elapsed: number, reveal: number): void {
    const gate = clamp01((reveal - 0.35) / 0.4)

    for (let i = 0; i < this.materials.length; i++) {
      const material = this.materials[i]!
      this.current[i] = damp(this.current[i]!, this.targets[i]!, 9, dt)

      // Uma respiração lenta, defasada por anel pra nunca pulsarem juntos.
      const breath = 1 + Math.sin(elapsed * 0.7 + i * 1.9) * 0.08
      material.opacity = this.current[i]! * gate * breath

      const lit = this.highlighted === i ? 1 : 0
      material.color.copy(this.restColor).lerp(this.litColor, lit * 0.85)
    }
  }

  dispose(): void {
    this.geometry.dispose()
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
