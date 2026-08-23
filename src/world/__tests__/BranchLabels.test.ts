import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { generateBranches, type BranchRecord } from '../BranchSystem'
import { assignBranches } from '../BranchLabels'

const arvore = generateBranches({ origin: new Vector3(0, 6.5, 0), depth: 6 })

/** Mais novo primeiro, que é como `virtual:posts` entrega. */
const posts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    slug: `p${i}`,
    titulo: `post ${i}`,
    data: `2026-01-${String(n - i).padStart(2, '0')}`,
  }))

describe('assignBranches', () => {
  it('dá um galho pra cada post', () => {
    expect(assignBranches(posts(5), arvore.branches)).toHaveLength(5)
  })

  it('devolve na ordem que recebeu', () => {
    expect(assignBranches(posts(4), arvore.branches).map((a) => a.slug)).toEqual([
      'p0', 'p1', 'p2', 'p3',
    ])
  })

  it('nunca põe dois posts no mesmo galho', () => {
    const ids = assignBranches(posts(12), arvore.branches).map((a) => a.branch.id)
    expect(new Set(ids).size).toBe(12)
  })

  it('é determinística, pra que um post não troque de galho entre visitas', () => {
    const a = assignBranches(posts(6), arvore.branches).map((x) => x.branch.id)
    const b = assignBranches(posts(6), arvore.branches).map((x) => x.branch.id)
    expect(a).toEqual(b)
  })

  it('um post mantém o galho quando outro é publicado depois dele', () => {
    const antigos = [
      { slug: 'b', titulo: 'b', data: '2026-02-01' },
      { slug: 'a', titulo: 'a', data: '2026-01-01' },
    ]
    const comNovo = [{ slug: 'c', titulo: 'c', data: '2026-03-01' }, ...antigos]

    const antes = new Map(assignBranches(antigos, arvore.branches).map((x) => [x.slug, x.branch.id]))
    const depois = new Map(assignBranches(comNovo, arvore.branches).map((x) => [x.slug, x.branch.id]))

    expect(depois.get('a')).toBe(antes.get('a'))
    expect(depois.get('b')).toBe(antes.get('b'))
    expect(depois.get('c')).not.toBe(antes.get('a'))
  })

  it('o mais antigo fica embaixo e o mais novo em cima, como galho cresce', () => {
    const escolhidos = assignBranches(posts(5), arvore.branches)
    const maisNovo = escolhidos[0]!.branch.tip.y
    const maisAntigo = escolhidos[4]!.branch.tip.y
    expect(maisNovo).toBeGreaterThan(maisAntigo)
  })

  it('prefere galho de meia profundidade, que é onde um rótulo cabe', () => {
    for (const a of assignBranches(posts(8), arvore.branches)) {
      expect(a.branch.depth).toBeGreaterThanOrEqual(2)
      expect(a.branch.depth).toBeLessThanOrEqual(4)
    }
  })

  it('espaça os galhos escolhidos', () => {
    const escolhidos = assignBranches(posts(6), arvore.branches)
    for (let i = 0; i < escolhidos.length; i++) {
      for (let j = i + 1; j < escolhidos.length; j++) {
        expect(
          escolhidos[i]!.branch.tip.distanceTo(escolhidos[j]!.branch.tip),
        ).toBeGreaterThan(0.9)
      }
    }
  })

  it('aguenta mais posts do que galhos ideais sem repetir nem cair', () => {
    // A árvore tem 329 galhos, 61 deles de profundidade 2..4. 120 força as
    // passadas de reserva sem chegar perto de esgotar a árvore. Medido, não
    // chutado — a contagem sai de `generateBranches` com a seed padrão.
    const muitos = assignBranches(posts(120), arvore.branches)
    expect(new Set(muitos.map((a) => a.branch.id)).size).toBe(120)
  })

  it('explode quando a árvore não tem galho pra todo mundo', () => {
    const poucos: BranchRecord[] = arvore.branches.slice(0, 3)
    expect(() => assignBranches(posts(10), poucos)).toThrow(/galhos/)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(assignBranches([], arvore.branches)).toEqual([])
  })
})
