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

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { splitFrontmatter } from '../../../plugins/posts'
import { aprendizado } from '../aprendizado'
import { CATEGORIAS, paixoes } from '../paixoes'
import { site } from '../site'
import { sobre } from '../sobre'

/** Raiz do repo, a partir deste arquivo — não `process.cwd()`, que muda com de onde o comando roda. */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../../..')

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

/**
 * Texto visível de `index.html`: `<title>`, o atributo `content` da meta
 * descrição e a prosa dentro de `<noscript>`.
 *
 * De propósito, não é um regex genérico sobre o arquivo inteiro — isso
 * pegaria nome de tag, nome de atributo, `lang="pt-BR"` e o `<!doctype html>`
 * do topo, que não são texto que alguém lê. Só os três pontos acima são.
 */
export function textosVisiveisHtml(html: string): string[] {
  const achados: string[] = []

  const titulo = /<title>([^<]*)<\/title>/.exec(html)?.[1]
  if (titulo) achados.push(titulo)

  // Duas etapas — acha a tag da meta descrição primeiro, o atributo dentro
  // dela depois — pra não depender de `name` vir antes de `content` na tag.
  const metaDescricao = /<meta\b[^>]*\bname=["']description["'][^>]*>/i.exec(html)?.[0]
  const descricao = metaDescricao && /\bcontent=["']([^"']*)["']/.exec(metaDescricao)?.[1]
  if (descricao) achados.push(descricao)

  const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1]
  if (noscript) {
    // Tira toda tag (título, parágrafo, o link) e sobra só o texto — o que
    // inclui o rótulo do link, mas nunca o `href` dele, que já saiu junto
    // com a tag inteira.
    const prosa = noscript
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (prosa) achados.push(prosa)
  }

  return achados
}

/**
 * `titulo` e `resumo` do frontmatter de cada post — os dois únicos campos
 * que viram texto visível (título da página, `<h1>`, lista do blog, sprite
 * 3D e meta descrição). `tags` não entra: vira só a cor da paleta do mundo
 * do post (`hueDaTag`), nunca aparece escrito.
 */
export function textosVisiveisFrontmatter(dir: string): string[] {
  const achados: string[] = []
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const { frontmatter } = splitFrontmatter(readFileSync(join(dir, arquivo), 'utf8'))
    if (!frontmatter) continue
    const dados = parseYaml(frontmatter) as Record<string, unknown> | null
    if (!dados) continue
    if (typeof dados['titulo'] === 'string') achados.push(dados['titulo'])
    if (typeof dados['resumo'] === 'string') achados.push(dados['resumo'])
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

describe('textosVisiveisHtml', () => {
  it('acha título, meta descrição e a prosa do noscript', () => {
    const html = `<html><head><title>um título</title>
      <meta name="description" content="uma descrição" />
      </head><body><noscript><h1>oi</h1><p>texto com <a href="https://x.com/Y">link</a>.</p></noscript></body></html>`
    const achados = textosVisiveisHtml(html)
    expect(achados).toContain('um título')
    expect(achados).toContain('uma descrição')
    expect(achados.some((t) => t.includes('oi') && t.includes('link'))).toBe(true)
    // o href com maiúscula não pode vazar pro texto — só o rótulo do link.
    expect(achados.some((t) => t.includes('x.com/Y'))).toBe(false)
  })

  it('não confunde doctype ou atributo com texto visível', () => {
    const html = '<!doctype html>\n<html lang="pt-BR"><head><title>oi</title></head></html>'
    expect(textosVisiveisHtml(html)).toEqual(['oi'])
  })
})

describe('todo texto do site é minúsculo', () => {
  const todos = [
    ...textosVisiveis(site),
    ...textosVisiveis(sobre),
    ...textosVisiveis(aprendizado),
    ...textosVisiveis(paixoes),
    ...textosVisiveis(CATEGORIAS),
    ...textosVisiveisHtml(readFileSync(join(RAIZ, 'index.html'), 'utf8')),
    ...textosVisiveisFrontmatter(join(RAIZ, 'content/posts')),
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
