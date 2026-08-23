import { describe, expect, it } from 'vitest'
import { Scene, Vector3, type ShaderMaterial } from 'three'
import { Quality } from '../../core/Quality'
import {
  beat,
  GeneratedPostWorld,
  hueDaTag,
  hueEnvelope,
  orphanWorlds,
  twigLit,
  type PostWorldContext,
} from '../PostWorld'

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

/**
 * Um `PostWorldContext` mínimo pra exercitar o ciclo de vida de
 * `GeneratedPostWorld`. `camera`, `rig` e `overlay` nunca são lidos por ela —
 * só `scene`, `branch`, `post` e `quality` são — então os três levam um
 * stub. `post` e `branch` são montados na mão, sem importar `Post` de
 * `virtual:posts` (que o vitest não resolve por design) nem `BranchRecord`:
 * a checagem estrutural do TypeScript basta.
 */
function contexto(reducedMotion: boolean): PostWorldContext {
  return {
    scene: new Scene(),
    camera: {} as unknown as PostWorldContext['camera'],
    branch: {
      id: 3,
      parentId: 1,
      depth: 2,
      vertexStart: 0,
      vertexEnd: 1,
      start: new Vector3(0, 7, 0),
      tip: new Vector3(1, 8, 0),
      along: new Vector3(0, 1, 0),
      length: 1,
    },
    post: {
      slug: 'teste',
      titulo: 'teste',
      data: '2026-01-01',
      resumo: '',
      tags: [],
      minutos: 1,
      html: '',
      paragrafos: 3,
      rascunho: false,
    },
    quality: new Quality({}, reducedMotion),
    rig: {} as unknown as PostWorldContext['rig'],
    overlay: {} as unknown as PostWorldContext['overlay'],
  }
}

/** Espia o uniforme privado — o ponto desta função é só o teste, não uma
 *  API pública nova: `GeneratedPostWorld` não tem motivo legítimo pra expor
 *  `uTime` além disto. */
function uTimeDe(mundo: GeneratedPostWorld): number {
  const material = (mundo as unknown as { material: ShaderMaterial }).material
  return material.uniforms['uTime']!.value as number
}

describe('GeneratedPostWorld — uTime', () => {
  it('avança com o tempo quando o movimento não está reduzido', () => {
    const mundo = new GeneratedPostWorld()
    mundo.build(contexto(false))

    mundo.update(1 / 60, 1, 0.5)
    const primeiro = uTimeDe(mundo)
    mundo.update(1 / 60, 2, 0.5)

    expect(uTimeDe(mundo)).toBeGreaterThan(primeiro)
    mundo.dispose()
  })

  it('fica parado sob movimento reduzido', () => {
    const mundo = new GeneratedPostWorld()
    mundo.build(contexto(true))

    mundo.update(1 / 60, 1, 0.5)
    const primeiro = uTimeDe(mundo)
    mundo.update(1 / 60, 2, 0.5)

    expect(uTimeDe(mundo)).toBe(primeiro)
    mundo.dispose()
  })
})
