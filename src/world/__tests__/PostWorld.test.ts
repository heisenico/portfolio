import { describe, expect, it } from 'vitest'
import { beat, hueDaTag, hueEnvelope, orphanWorlds, twigLit } from '../PostWorld'

describe('twigLit', () => {
  it('no topo do texto nada está aceso', () => {
    // O shader acende quando aTwigIndex <= uLit, e o primeiro galhinho é o
    // índice 0 — então "nada aceso" tem que ser um valor negativo, não zero.
    expect(twigLit(0, 6)).toBe(-1)
  })

  it('no fim do texto o último galhinho está aceso e nem um a mais', () => {
    expect(twigLit(1, 6)).toBe(5)
  })

  it('no meio acende metade', () => {
    expect(twigLit(0.5, 6)).toBe(2)
  })

  it('cresce sem voltar atrás', () => {
    let anterior = -Infinity
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = twigLit(t, 9)
      expect(v).toBeGreaterThanOrEqual(anterior)
      anterior = v
    }
  })

  it('trava fora de 0..1', () => {
    expect(twigLit(-2, 6)).toBe(-1)
    expect(twigLit(4, 6)).toBe(5)
  })

  it('um post sem galhinho nenhum não acende nada', () => {
    expect(twigLit(1, 0)).toBe(-1)
  })
})

describe('beat', () => {
  it('é zero antes da janela e um depois dela', () => {
    expect(beat(0.1, 0.3, 0.6)).toBe(0)
    expect(beat(0.9, 0.3, 0.6)).toBe(1)
  })

  it('é meio no meio da janela', () => {
    expect(beat(0.45, 0.3, 0.6)).toBeCloseTo(0.5, 6)
  })

  it('uma janela de largura zero vira um degrau, sem dividir por zero', () => {
    expect(beat(0.29, 0.3, 0.3)).toBe(0)
    expect(beat(0.3, 0.3, 0.3)).toBe(1)
    expect(Number.isFinite(beat(0.5, 0.3, 0.3))).toBe(true)
  })

  it('uma janela invertida não devolve NaN nem negativo', () => {
    const v = beat(0.5, 0.8, 0.2)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
  })
})

describe('hueDaTag', () => {
  it('sem tag é o verde da casa, exatamente', () => {
    expect(hueDaTag(undefined)).toBe(150)
  })

  it('a mesma tag dá sempre o mesmo tom', () => {
    expect(hueDaTag('carreira')).toBe(hueDaTag('carreira'))
  })

  it('tags diferentes tendem a dar tons diferentes', () => {
    const tons = new Set(['meta', 'carreira', 'código', 'roça', 'cinema'].map(hueDaTag))
    expect(tons.size).toBeGreaterThanOrEqual(4)
  })

  it('nunca sai da vizinhança do verde — o contrato do mundo exige', () => {
    for (const tag of ['a', 'bb', 'ccc', 'zzzzzz', 'ção', '']) {
      expect(hueDaTag(tag)).toBeGreaterThanOrEqual(80)
      expect(hueDaTag(tag)).toBeLessThanOrEqual(220)
    }
  })
})

describe('hueEnvelope', () => {
  it('começa verde', () => {
    expect(hueEnvelope(0, 200)).toBe(150)
  })

  it('chega no tom da tag no meio da leitura', () => {
    expect(hueEnvelope(0.5, 200)).toBe(200)
  })

  it('volta pro verde a partir de 0.97', () => {
    expect(hueEnvelope(0.97, 200)).toBe(150)
    expect(hueEnvelope(1, 200)).toBe(150)
  })
})

describe('orphanWorlds', () => {
  it('sem mundo à mão nenhum, não sobra órfão pra lista que for', () => {
    expect(orphanWorlds(['a', 'b'], [])).toEqual([])
    expect(orphanWorlds([], [])).toEqual([])
  })

  it('acusa um mundo à mão cujo slug não está entre os posts', () => {
    const caminhos = ['/content/worlds/como-cheguei-aqui.ts', '/content/worlds/fantasma.ts']
    expect(orphanWorlds(['como-cheguei-aqui'], caminhos)).toEqual(['fantasma'])
  })

  it('sem passar caminhos, usa o glob real — hoje vazio, então nunca acusa nada', () => {
    expect(orphanWorlds(['qualquer-slug'])).toEqual([])
  })
})
