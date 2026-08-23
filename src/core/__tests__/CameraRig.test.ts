import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { computeFlight, scrollDolly, shortestAngle, type Enquadramento } from '../CameraRig'

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

const de: Enquadramento = { focus: new Vector3(0, 7, 0), halfWidth: 8, halfHeight: 10 }
const para: Enquadramento = { focus: new Vector3(4, 12, -2), halfWidth: 2, halfHeight: 3 }

describe('computeFlight', () => {
  it('em t=0 é exatamente a origem', () => {
    const q = computeFlight(de, para, 0)
    expect(q.focus.toArray()).toEqual([0, 7, 0])
    expect(q.halfWidth).toBe(8)
    expect(q.halfHeight).toBe(10)
  })

  it('em t=1 é exatamente o destino', () => {
    const q = computeFlight(de, para, 1)
    expect(q.focus.toArray()).toEqual([4, 12, -2])
    expect(q.halfWidth).toBe(2)
    expect(q.halfHeight).toBe(3)
  })

  it('nunca sai de dentro dos dois extremos', () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const q = computeFlight(de, para, t)
      expect(q.focus.x).toBeGreaterThanOrEqual(0)
      expect(q.focus.x).toBeLessThanOrEqual(4)
      expect(q.focus.z).toBeLessThanOrEqual(0)
      expect(q.focus.z).toBeGreaterThanOrEqual(-2)
      expect(q.halfWidth).toBeLessThanOrEqual(8)
      expect(q.halfWidth).toBeGreaterThanOrEqual(2)
    }
  })

  it('não devolve o mesmo objeto de entrada, que seria alias silencioso', () => {
    const q = computeFlight(de, para, 0)
    expect(q.focus).not.toBe(de.focus)
  })
})

describe('shortestAngle', () => {
  it('vai pelo lado curto ao cruzar π', () => {
    expect(shortestAngle(3.0, -3.0)).toBeCloseTo(0.2831853, 5)
  })
  it('é zero pra ângulos iguais', () => {
    expect(shortestAngle(1.2, 1.2)).toBe(0)
  })
  it('nunca passa de meia volta', () => {
    for (let a = -10; a < 10; a += 0.37) {
      for (let b = -10; b < 10; b += 0.53) {
        expect(Math.abs(shortestAngle(a, b))).toBeLessThanOrEqual(Math.PI + 1e-9)
      }
    }
  })
})
