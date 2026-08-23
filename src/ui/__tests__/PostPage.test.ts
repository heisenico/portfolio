import { describe, expect, it } from 'vitest'
import { readingProgress } from '../pages/PostPage'

// topo=200, altura=2000, viewport=800 → 1200px de rolagem útil, de 200 a 1400.
const p = (scrollY: number) => readingProgress(scrollY, 200, 2000, 800)

describe('readingProgress', () => {
  it('é zero antes do artigo começar a sair da tela', () => {
    expect(p(0)).toBe(0)
    expect(p(200)).toBe(0)
  })

  it('é um quando o fim do artigo encosta no fim da tela', () => {
    expect(p(1400)).toBe(1)
  })

  it('é meio no meio', () => {
    expect(p(800)).toBeCloseTo(0.5, 6)
  })

  it('trava nas pontas, porque rolagem elástica passa dos limites', () => {
    expect(p(-300)).toBe(0)
    expect(p(9000)).toBe(1)
  })

  it('um artigo que cabe na tela já nasce completo', () => {
    // Não há o que rolar, então não há o que revelar aos poucos. O CSS do
    // leitor dá folga embaixo justamente pra que este caso seja raro.
    expect(readingProgress(0, 100, 400, 800)).toBe(1)
  })

  it('nunca devolve NaN, nem com altura igual à viewport', () => {
    expect(Number.isFinite(readingProgress(0, 0, 800, 800))).toBe(true)
  })
})
