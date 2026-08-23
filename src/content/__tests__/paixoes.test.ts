import { describe, expect, it } from 'vitest'
import { agruparPaixoes, alturasDosAneis, paixoes, type Paixao } from '../paixoes'

describe('agruparPaixoes', () => {
  it('segue a ordem de CATEGORIAS, não a ordem da lista', () => {
    const lista: Paixao[] = [
      { nome: 'cozinhar', categoria: 'maos' },
      { nome: 'surf', categoria: 'corpo' },
    ]
    expect(agruparPaixoes(lista).map((g) => g.categoria)).toEqual(['corpo', 'maos'])
  })

  it('preserva a ordem de entrada dentro de cada categoria', () => {
    const lista: Paixao[] = [
      { nome: 'yoga', categoria: 'corpo' },
      { nome: 'surf', categoria: 'corpo' },
    ]
    expect(agruparPaixoes(lista)[0]!.itens.map((p) => p.nome)).toEqual(['yoga', 'surf'])
  })

  it('descarta categoria vazia em vez de emitir um grupo sem nada', () => {
    expect(agruparPaixoes([{ nome: 'surf', categoria: 'corpo' }])).toHaveLength(1)
  })

  it('explode numa categoria que não existe, em vez de sumir com a paixão', () => {
    const torta = [{ nome: 'x', categoria: 'cabeca' }] as unknown as Paixao[]
    expect(() => agruparPaixoes(torta)).toThrow(/cabeca/)
  })

  it('a lista de verdade cabe inteira nos grupos', () => {
    const total = agruparPaixoes(paixoes).reduce((n, g) => n + g.itens.length, 0)
    expect(total).toBe(paixoes.length)
  })
})

describe('alturasDosAneis', () => {
  it('um anel só fica no meio do vão', () => {
    expect(alturasDosAneis([1], -2, 2, 1.5)).toEqual([[0]])
  })

  it('preenche o vão inteiro, seja qual for a contagem', () => {
    for (const grupos of [[2], [3, 2], [1, 1, 1], [6, 4]]) {
      const ys = alturasDosAneis(grupos, -2, 2, 1.5).flat()
      expect(ys[0]).toBeCloseTo(-2, 5)
      expect(ys.at(-1)).toBeCloseTo(2, 5)
    }
  })

  it('sobe sempre, nunca repete altura', () => {
    const ys = alturasDosAneis([3, 2], -2, 2, 1.5).flat()
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!)
  })

  it('o vão entre bandas é maior que o vão dentro de uma banda', () => {
    const [a, b] = alturasDosAneis([2, 2], -2, 2, 1.5) as [number[], number[]]
    const dentro = a[1]! - a[0]!
    const entre = b[0]! - a[1]!
    expect(entre).toBeGreaterThan(dentro)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(alturasDosAneis([], -2, 2, 1.5)).toEqual([])
  })
})
