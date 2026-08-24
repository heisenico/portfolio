import { describe, expect, it } from 'vitest'
import { AMBER, AMBER_INVERTIDO, INK, INK_FAINT, INK_REST, PAPER } from '../palette'

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

  it('o âmbar invertido é o complemento exato, pra sair certo depois do passe final', () => {
    expect(AMBER_INVERTIDO).toBe(0xffffff - AMBER)
  })
})
