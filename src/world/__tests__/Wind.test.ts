import { describe, expect, it } from 'vitest'
import { Wind } from '../Wind'

describe('Wind', () => {
  it('começa parado', () => expect(new Wind().strength).toBe(0))

  it('ganha força num empurrão e decai até sumir', () => {
    const w = new Wind()
    w.push(1, 0)
    w.update(1 / 60)
    expect(w.strength).toBeGreaterThan(0)
    for (let i = 0; i < 600; i++) w.update(1 / 60)
    expect(w.strength).toBeLessThan(0.01)
  })

  it('satura, por mais forte que seja o empurrão', () => {
    const w = new Wind()
    for (let i = 0; i < 200; i++) w.push(10, 10)
    w.update(1 / 60)
    expect(w.strength).toBeLessThanOrEqual(1)
  })

  it('aponta pro lado que foi empurrado', () => {
    const w = new Wind()
    w.push(-1, 0)
    w.update(1 / 60)
    expect(w.vector.x).toBeLessThan(0)
  })

  it('um dt gigante não faz a força explodir nem virar NaN', () => {
    // Uma aba que volta do background entrega um dt de vários segundos.
    const w = new Wind()
    w.push(1, 1)
    w.update(5)
    expect(Number.isFinite(w.strength)).toBe(true)
    expect(w.strength).toBeLessThanOrEqual(1)
  })
})
