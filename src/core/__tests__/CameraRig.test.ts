import { describe, expect, it } from 'vitest'
import { scrollDolly } from '../CameraRig'

describe('scrollDolly', () => {
  it('não faz nada no topo da página', () => {
    expect(scrollDolly(0)).toEqual({ ganhoRaio: 1, subida: 0 })
  })

  it('afasta e sobe a câmera no fim da página', () => {
    const d = scrollDolly(1)
    expect(d.ganhoRaio).toBeGreaterThan(1)
    expect(d.subida).toBeGreaterThan(0)
  })

  it('cresce sem voltar atrás', () => {
    let anterior = -Infinity
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const { ganhoRaio } = scrollDolly(t)
      expect(ganhoRaio).toBeGreaterThanOrEqual(anterior)
      anterior = ganhoRaio
    }
  })

  it('trava fora de 0..1, porque scrollProgress já vazou desses limites antes', () => {
    expect(scrollDolly(-3)).toEqual(scrollDolly(0))
    expect(scrollDolly(9)).toEqual(scrollDolly(1))
  })
})
