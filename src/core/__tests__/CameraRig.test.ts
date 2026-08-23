import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  computeFlight,
  fitRadius,
  lateralShift,
  MAX_RADIUS,
  MIN_RADIUS,
  scrollDolly,
  shortestAngle,
  type Enquadramento,
} from '../CameraRig'

/** Câmera de referência do relatório do defeito: viewport 1470×712, fov 46°. */
const FOV = 46
const ASPECT = 1470 / 712

describe('scrollDolly', () => {
  it('não faz nada no topo da página', () => {
    expect(scrollDolly(0)).toEqual({ ganhoRaio: 1, subida: 0 })
  })

  it('afasta e sobe a câmera no fim da página', () => {
    const d = scrollDolly(1)
    expect(d.ganhoRaio).toBeGreaterThan(1)
    expect(d.subida).toBeGreaterThan(0)
  })

  it('cresce sem voltar atrás', () => {
    let anterior = -Infinity
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const { ganhoRaio } = scrollDolly(t)
      expect(ganhoRaio).toBeGreaterThanOrEqual(anterior)
      anterior = ganhoRaio
    }
  })

  it('trava fora de 0..1, porque scrollProgress já vazou desses limites antes', () => {
    expect(scrollDolly(-3)).toEqual(scrollDolly(0))
    expect(scrollDolly(9)).toEqual(scrollDolly(1))
  })
})

const de: Enquadramento = { focus: new Vector3(0, 7, 0), halfWidth: 8, halfHeight: 10 }
const para: Enquadramento = { focus: new Vector3(4, 12, -2), halfWidth: 2, halfHeight: 3 }

describe('computeFlight', () => {
  it('em t=0 é exatamente a origem', () => {
    const q = computeFlight(de, para, 0)
    expect(q.focus.toArray()).toEqual([0, 7, 0])
    expect(q.halfWidth).toBe(8)
    expect(q.halfHeight).toBe(10)
  })

  it('em t=1 é exatamente o destino', () => {
    const q = computeFlight(de, para, 1)
    expect(q.focus.toArray()).toEqual([4, 12, -2])
    expect(q.halfWidth).toBe(2)
    expect(q.halfHeight).toBe(3)
  })

  it('nunca sai de dentro dos dois extremos', () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const q = computeFlight(de, para, t)
      expect(q.focus.x).toBeGreaterThanOrEqual(0)
      expect(q.focus.x).toBeLessThanOrEqual(4)
      expect(q.focus.z).toBeLessThanOrEqual(0)
      expect(q.focus.z).toBeGreaterThanOrEqual(-2)
      expect(q.halfWidth).toBeLessThanOrEqual(8)
      expect(q.halfWidth).toBeGreaterThanOrEqual(2)
    }
  })

  it('não devolve o mesmo objeto de entrada, que seria alias silencioso', () => {
    const q = computeFlight(de, para, 0)
    expect(q.focus).not.toBe(de.focus)
  })
})

describe('shortestAngle', () => {
  it('vai pelo lado curto ao cruzar π', () => {
    expect(shortestAngle(3.0, -3.0)).toBeCloseTo(0.2831853, 5)
  })
  it('é zero pra ângulos iguais', () => {
    expect(shortestAngle(1.2, 1.2)).toBe(0)
  })
  it('nunca passa de meia volta', () => {
    for (let a = -10; a < 10; a += 0.37) {
      for (let b = -10; b < 10; b += 0.53) {
        expect(Math.abs(shortestAngle(a, b))).toBeLessThanOrEqual(Math.PI + 1e-9)
      }
    }
  })
})

describe('fitRadius', () => {
  it('não trava mais num galho pequeno: o defeito medido em produção', () => {
    // O post "como-cheguei-aqui": meia-extensão 1.99 (branch.length ≈ 3.2),
    // igual ao que o relatório mediu. O MIN_RADIUS antigo (12) travava isto
    // em 12, a 15+ unidades reais de câmera — o bug. O novo piso (3) não
    // trava mais: o ajuste natural, ~4.97, decide.
    const raio = fitRadius(1.99, 1.99, FOV, ASPECT)
    expect(raio).toBeCloseTo(4.9694, 3)
    expect(raio).toBeGreaterThan(MIN_RADIUS)
    expect(raio).toBeLessThan(12)
  })

  it('a árvore inteira nem chega perto do piso — inalterada pelo corte', () => {
    // Meia-extensões de `generateBranches` (ver o comentário de `CANOPY_Y`
    // em BlogPage.ts): halfWidth≈10.47, halfHeight≈9.40. O raio natural fica
    // bem acima de MIN_RADIUS tanto no valor antigo (12) quanto no novo (3),
    // então baixar o piso não move o enquadramento da home nem do /blog.
    const raio = fitRadius(10.47, 9.4, FOV, ASPECT)
    expect(raio).toBeGreaterThan(12)
    expect(raio).toBeCloseTo(23.4737, 3)
  })

  it('ainda trava um assunto degenerado — o piso continua sendo um piso', () => {
    expect(fitRadius(0.001, 0.001, FOV, ASPECT)).toBe(MIN_RADIUS)
  })

  it('respeita o teto pra um assunto enorme', () => {
    expect(fitRadius(500, 500, FOV, ASPECT)).toBe(MAX_RADIUS)
  })
})

describe('lateralShift', () => {
  it('no azimute de repouso 0 (árvore, copa, 404) e folga 0, é o termo antigo — sem shiftZ', () => {
    // A garantia de não-regressão: home/blog/404 nunca pedem `folga`, e o
    // azimute deles nunca sai de 0 (`flyTo` sempre chama `partir` com
    // azimute 0). Nessas condições o novo mecanismo tem que produzir
    // exatamente o número antigo, bit a bit.
    const raio = fitRadius(10.47, 9.4, FOV, ASPECT)
    const { shiftX, shiftZ } = lateralShift(10.47, raio, FOV, ASPECT, 0, 0, true)
    expect(shiftX).toBeCloseTo(-10.47 * 0.42, 10)
    expect(shiftZ).toBe(0)
  })

  it('tela estreita não empurra nem em X nem em Z', () => {
    const { shiftX, shiftZ } = lateralShift(10.47, 23, FOV, ASPECT, 0, 0.3, false)
    expect(shiftX).toBe(0)
    // -0, não 0: `lateral` é 0 (tela estreita não empurra), e `-0 * sin(0)`
    // é -0 em ponto flutuante — mesma grandeza, `toBeCloseTo` não distingue.
    expect(shiftZ).toBeCloseTo(0, 10)
  })

  it('a intensidade do empurrão não muda com o azimute, só a direção', () => {
    // O bug de produção: um empurrão cru em X do mundo quase desaparecia
    // quando o galho pousava perto de 90°. Girar o mesmo vetor pra
    // qualquer azimute tem que preservar o módulo.
    const raio = fitRadius(1.99, 1.99, FOV, ASPECT)
    const modulo = (az: number) => {
      const { shiftX, shiftZ } = lateralShift(1.99, raio, FOV, ASPECT, az, 0.3, true)
      return Math.hypot(shiftX, shiftZ)
    }
    const referencia = modulo(0)
    for (let az = -Math.PI; az <= Math.PI; az += 0.3) {
      expect(modulo(az)).toBeCloseTo(referencia, 10)
    }
  })

  it('a 90° o empurrão cai inteiro em Z, nada sobra em X', () => {
    const raio = fitRadius(1.99, 1.99, FOV, ASPECT)
    const { shiftX, shiftZ } = lateralShift(1.99, raio, FOV, ASPECT, Math.PI / 2, 0.3, true)
    expect(Math.abs(shiftX)).toBeLessThan(1e-9)
    expect(Math.abs(shiftZ)).toBeGreaterThan(2)
  })

  it('empurra o galho da rua bem além da coluna de leitura (~0.37 de NDC)', () => {
    // A conta de aceitação do relatório: coluna `--measure` (34rem) centrada
    // numa janela de 1470px cobre até ~0.37 da metade da tela. O empurrão
    // total (termo antigo + `folga`) tem que passar disso com folga real,
    // não só encostar — refeito aqui como a projeção NDC exata (não uma
    // aproximação), pra pegar regressão de sinal ou de magnitude.
    const raio = fitRadius(1.99, 1.99, FOV, ASPECT)
    const azimute = Math.PI / 2
    const { shiftX, shiftZ } = lateralShift(1.99, raio, FOV, ASPECT, azimute, 0.3, true)
    const lateral = Math.hypot(shiftX, shiftZ)
    const vFov = (FOV * Math.PI) / 180
    const hHalfAngle = Math.atan(Math.tan(vFov / 2) * ASPECT)
    const ndc = lateral / (raio * Math.tan(hHalfAngle))
    expect(ndc).toBeGreaterThan(0.37)
    // ...e não tão longe que o próprio galho estoure a borda oposta da lente
    // (NDC 1.0) — meia-largura real da rua (`RUA_COMPRIMENTO / 2` ≈ 1.6)
    // projetada no mesmo raio.
    const meiaLarguraRua = 1.6 / (raio * Math.tan(hHalfAngle))
    expect(ndc + meiaLarguraRua).toBeLessThan(1)
  })
})
