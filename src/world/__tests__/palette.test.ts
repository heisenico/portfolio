import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AMBER, AMBER_INVERTIDO, INK, INK_FAINT, INK_REST, PAPER } from '../palette'
import { naTela } from './aces'

const raiz = fileURLToPath(new URL('../../../', import.meta.url))

function cinza(hex: number): boolean {
  const r = (hex >> 16) & 255
  const g = (hex >> 8) & 255
  const b = hex & 255
  return r === g && g === b
}

describe('palette', () => {
  it('todo tom do mundo é cinza', () => {
    for (const tom of [PAPER, INK, INK_REST, INK_FAINT]) expect(cinza(tom)).toBe(true)
  })

  it('o papel é preto puro e a tinta branca pura — senão a inversão dá um branco sujo', () => {
    expect(PAPER).toBe(0x000000)
    expect(INK).toBe(0xffffff)
  })

  it('o âmbar é a única cor, e é exatamente a do gato', () => {
    expect(AMBER).toBe(0xffc27a)
    expect(cinza(AMBER)).toBe(false)
  })

  // O complemento ingênuo (`0xffffff - AMBER`) está errado: o frame passa por
  // ACES antes da inversão, e ACES não é simétrico sob `1 - x`. Invertendo o
  // complemento chega-se a `#ffc864`, não a `#ffc27a`. O único jeito de fixar a
  // cor do gato é rodar o pipeline — `aces.ts` faz isso.
  it('o âmbar invertido sai #ffc27a na tela, depois de ACES e do passe final', () => {
    const [r, g, b] = naTela(AMBER_INVERTIDO, 1.22, true)
    expect(Math.abs(r - 0xff)).toBeLessThanOrEqual(1)
    expect(Math.abs(g - 0xc2)).toBeLessThanOrEqual(1)
    expect(Math.abs(b - 0x7a)).toBeLessThanOrEqual(1)
  })

  it('o âmbar da noite sai lavado por ACES, e é assim que o autor o quis', () => {
    // Âncora do modelo: sem inversão, `AMBER` cheio chega à tela como #ebd4a5.
    // Se `aces.ts` desandar, este teste cai junto com o de cima.
    const [r, g, b] = naTela(AMBER, 1.22, false)
    expect(Math.abs(r - 0xeb)).toBeLessThanOrEqual(3)
    expect(Math.abs(g - 0xd4)).toBeLessThanOrEqual(3)
    expect(Math.abs(b - 0xa5)).toBeLessThanOrEqual(3)
  })
})

describe('nenhuma cor fora da paleta', () => {
  // `src/world/` e `content/worlds/`: tudo que desenha no mundo. Um hex
  // literal fora de palette.ts é uma segunda paleta nascendo.
  const pastas = ['src/world', 'content/worlds']

  it.each(pastas)('%s não carrega hex próprio', (pasta) => {
    for (const nome of readdirSync(join(raiz, pasta))) {
      if (!nome.endsWith('.ts') || nome === 'palette.ts') continue
      const fonte = readFileSync(join(raiz, pasta, nome), 'utf8')
      const achado = /\b0x[0-9a-fA-F]{6}\b|['"]#[0-9a-fA-F]{3,6}['"]/.exec(fonte)
      expect(achado, `${pasta}/${nome}: ${achado?.[0]}`).toBeNull()
    }
  })
})
