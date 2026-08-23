/**
 * Coisas que ele aprendeu a fazer e gosta de fazer.
 *
 * Sem anos. A versão anterior media cada hobby em tempo — "surf, 12 anos" —
 * e transformava gosto em currículo: quem dança há três anos parecia dançar
 * menos do que quem surfa há doze, o que não quer dizer nada sobre nenhum dos
 * dois. O que interessa é que a pessoa sabe fazer, não desde quando.
 *
 * As categorias existem porque cinco linhas soltas viram uma lista qualquer.
 * Separadas em "com o corpo" e "com as mãos", viram duas ideias — e no tronco
 * viram duas bandas de anéis com um vão entre elas, que é uma forma, em vez de
 * cinco anéis igualmente espaçados, que é um código de barras.
 *
 * Pra acrescentar uma paixão: uma linha em `paixoes`. Os anéis se redistribuem
 * sozinhos pelo mesmo trecho do tronco — ver `alturasDosAneis`.
 */

export type CategoriaId = 'corpo' | 'maos'

export interface Paixao {
  nome: string
  categoria: CategoriaId
  /** Uma linha, opcional. Sem nota é melhor que com nota inventada. */
  nota?: string
}

export interface Grupo {
  categoria: CategoriaId
  rotulo: string
  itens: Paixao[]
}

/** A ordem daqui é a ordem na página e no tronco, de baixo pra cima. */
export const CATEGORIAS = [
  { id: 'corpo', rotulo: 'com o corpo' },
  { id: 'maos', rotulo: 'com as mãos' },
] as const satisfies readonly { id: CategoriaId; rotulo: string }[]

export const paixoes: Paixao[] = [
  { nome: 'surf', categoria: 'corpo', nota: 'o mar não negocia.' },
  { nome: 'forró', categoria: 'corpo', nota: 'dançar é a única coisa que me tira da cabeça.' },
  { nome: 'yoga', categoria: 'corpo' },
  { nome: 'cozinhar', categoria: 'maos' },
  { nome: 'cerâmica', categoria: 'maos' },
]

export function agruparPaixoes(lista: Paixao[]): Grupo[] {
  const validas = new Set<string>(CATEGORIAS.map((c) => c.id))
  for (const p of lista) {
    // Uma categoria com erro de digitação sumiria da página em silêncio, e o
    // silêncio é pior que o build vermelho.
    if (!validas.has(p.categoria)) {
      throw new Error(`paixoes: "${p.nome}" está na categoria desconhecida "${p.categoria}"`)
    }
  }

  return CATEGORIAS.map((c) => ({
    categoria: c.id,
    rotulo: c.rotulo,
    itens: lista.filter((p) => p.categoria === c.id),
  })).filter((g) => g.itens.length > 0)
}

/**
 * Distribui os anéis pelo trecho `de`..`ate` do tronco.
 *
 * O trecho é fixo: cinco paixões e onze paixões ocupam a mesma altura, só que
 * mais apertadas. Espaçamento constante faria uma lista longa subir tronco
 * acima até a copa.
 *
 * `folga` é quantos passos de anel vale o vão entre uma banda e a seguinte.
 *
 * @returns uma lista de alturas por grupo, na mesma ordem de `grupos`.
 */
export function alturasDosAneis(
  grupos: number[],
  de: number,
  ate: number,
  folga: number,
): number[][] {
  const total = grupos.reduce((n, g) => n + g, 0)
  if (total === 0) return []
  if (total === 1) return grupos.map((n) => (n === 1 ? [(de + ate) / 2] : []))

  const passos = total - 1 + (grupos.length - 1) * folga
  const passo = (ate - de) / passos

  let cursor = de
  return grupos.map((n, g) => {
    const alturas: number[] = []
    for (let i = 0; i < n; i++) {
      alturas.push(cursor)
      if (i < n - 1) cursor += passo
    }
    if (g < grupos.length - 1) cursor += passo * (1 + folga)
    return alturas
  })
}
