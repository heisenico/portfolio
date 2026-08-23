/**
 * A regra da caixa baixa, como teste em vez de como combinado.
 *
 * O site inteiro é escrito em minúscula. Isso é decisão de design, e decisão
 * de design que mora só na cabeça de alguém volta atrás na primeira edição de
 * texto às onze da noite. Aqui ela quebra o build.
 *
 * `text-transform: lowercase` resolveria visualmente e mentiria pro leitor de
 * tela, que anuncia o texto de verdade — por isso a minúscula é escrita na
 * fonte, e é isto que este teste verifica.
 */

import { describe, expect, it } from 'vitest'
import { aprendizado } from '../aprendizado'
import { site } from '../site'
import { sobre } from '../sobre'

/** Chaves cujo valor é URL, id ou enum — não texto que alguém lê. */
const NAO_E_TEXTO = new Set(['href', 'id', 'categoria'])

/**
 * Coleta toda string de texto visível. Item de array herda a chave do array,
 * porque `corpo: string[]` é um parágrafo por posição e não tem chave própria.
 */
export function textosVisiveis(valor: unknown, chave = '', achados: string[] = []): string[] {
  if (typeof valor === 'string') {
    if (!NAO_E_TEXTO.has(chave)) achados.push(valor)
    return achados
  }
  if (Array.isArray(valor)) {
    for (const item of valor) textosVisiveis(item, chave, achados)
    return achados
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) textosVisiveis(v, k, achados)
  }
  return achados
}

describe('textosVisiveis', () => {
  it('ignora href, id e categoria', () => {
    expect(textosVisiveis({ href: 'https://X.com', rotulo: 'x' })).toEqual(['x'])
  })
  it('desce em array de string herdando a chave', () => {
    expect(textosVisiveis({ corpo: ['um', 'dois'] })).toEqual(['um', 'dois'])
  })
})

describe('todo texto do site é minúsculo', () => {
  const todos = [
    ...textosVisiveis(site),
    ...textosVisiveis(sobre),
    ...textosVisiveis(aprendizado),
  ]

  // Se o caminhador parar de achar as strings, o teste passa por vazio. Este
  // piso é o que impede isso de acontecer em silêncio.
  it('encontra a cópia toda', () => {
    expect(todos.length).toBeGreaterThan(20)
  })

  it('não tem uma única maiúscula', () => {
    expect(todos.filter((t) => t !== t.toLocaleLowerCase('pt-BR'))).toEqual([])
  })
})

describe('o nome', () => {
  it('é o nome inteiro, minúsculo', () => {
    expect(site.perfil.nome).toBe('nicholas ferrer alencar')
  })
})
