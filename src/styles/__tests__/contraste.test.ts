/**
 * A tabela de contraste, como teste em vez de markdown.
 *
 * Lê `tokens.css` direto — não há build de CSS no caminho — e calcula a razão
 * WCAG 2.x de cada par que o spec promete. Se alguém mexer num token e
 * derrubar um par abaixo de AA, isto falha em vez de virar um `[ ]` esquecido
 * num plano.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')

/**
 * O `:root { ... }` de topo (`media === null`) ou o único `:root` dentro do
 * `@media` pedido. O parser é deliberadamente burro: tokens.css é escrito na
 * forma que ele espera, e o comentário de cabeçalho de lá diz isso.
 */
function bloco(media: string | null): string {
  if (media === null) {
    const m = /^:root\s*\{([^}]*)\}/m.exec(css)
    if (!m) throw new Error(':root de topo não encontrado em tokens.css')
    return m[1]!
  }
  // A abertura de bloco de verdade — começo de linha e `{` logo depois. Sem
  // essas duas âncoras o `indexOf` casa com a própria menção a
  // `@media (prefers-contrast: less)` no comentário de cabeçalho de tokens.css,
  // e o teste vai medir o `:root` de topo achando que está no bloco.
  const inicio = css.indexOf(`\n@media ${media} {`)
  if (inicio < 0) throw new Error(`@media ${media} não encontrado em tokens.css`)
  const abre = css.indexOf('{', css.indexOf(':root', inicio))
  const fecha = css.indexOf('}', abre)
  return css.slice(abre + 1, fecha)
}

function token(corpo: string, nome: string): string {
  const m = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(corpo)
  if (!m) throw new Error(`--${nome} não é um hex de 6 dígitos neste bloco`)
  return m[1]!.toLowerCase()
}

function canal(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
}

function luminancia(hex: string): number {
  const lin = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(canal(hex, 0)) + 0.7152 * lin(canal(hex, 1)) + 0.0722 * lin(canal(hex, 2))
}

/** Razão de contraste WCAG 2.x, sempre >= 1. */
function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** `color-mix(in srgb, frente P%, fundo)` — mistura por canal, sem gama. */
function mistura(frente: string, fundo: string, p: number): string {
  const hex = [0, 1, 2]
    .map((i) => Math.round((canal(frente, i) * p + canal(fundo, i) * (1 - p)) * 255))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}

/** Opacidade do card em glass.css. Se mudar lá, muda aqui. */
const CARD_PAPEL = 0.84

const temas = [
  { nome: 'papel', media: null },
  { nome: 'noite', media: '(prefers-color-scheme: dark)' },
  { nome: 'papel, menos contraste', media: '(prefers-contrast: less)' },
  { nome: 'noite, menos contraste', media: '(prefers-contrast: less) and (prefers-color-scheme: dark)' },
]

describe.each(temas)('tema $nome', ({ media }) => {
  const base = bloco(null)
  const proprio = media === null ? base : bloco(media)
  /*
   * Um bloco de @media só redefine o que muda; o resto herda do topo. A
   * herança vale para token *ausente*, e só. Se o token está declarado ali e
   * não é um hex de 6 dígitos — um `color-mix`, por exemplo — `token` grita.
   * Cair no valor de topo nesse caso seria medir o contraste do tema errado e
   * dizer que passou.
   */
  const ler = (nome: string): string =>
    new RegExp(`--${nome}\\s*:`).test(proprio) ? token(proprio, nome) : token(base, nome)
  const paper = ler('paper')
  const ink = ler('ink')

  it('texto sobre papel passa AA com folga', () => {
    expect(contraste(ink, paper)).toBeGreaterThanOrEqual(4.5)
  })

  it('texto sobre o card no pior caso passa AA', () => {
    // Pior caso: uma linha de tinta pura atrás do card, atravessando 16% do
    // vidro. Tinta pura no papel é `ink`, então o fundo do texto vira a
    // mistura de paper a 84% sobre ink.
    const fundoPior = mistura(paper, ink, CARD_PAPEL)
    expect(contraste(ink, fundoPior)).toBeGreaterThanOrEqual(4.5)
  })

  it('o anel de foco passa 3:1 contra o papel', () => {
    expect(contraste(ink, paper)).toBeGreaterThanOrEqual(3)
  })
})

describe('o âmbar do gato', () => {
  // O âmbar não é token de CSS — mora em src/world/palette.ts — mas o par
  // que faz o gato legível é decidido aqui, contra os tokens.
  const AMBAR = '#ffc27a'

  it('lê contra o papel da noite', () => {
    expect(contraste(AMBAR, token(bloco('(prefers-color-scheme: dark)'), 'paper'))).toBeGreaterThanOrEqual(3)
  })

  it('lê contra o corpo de tinta no papel', () => {
    // No papel o gato é corpo de tinta com forro âmbar: o forro é lido contra
    // o corpo, nunca contra o papel (onde daria 1.58:1).
    expect(contraste(AMBAR, token(bloco(null), 'ink'))).toBeGreaterThanOrEqual(3)
  })
})
