import { describe, expect, it } from 'vitest'
import {
  countParagraphs,
  parsePost,
  readingMinutes,
  slugFromFilename,
  splitFrontmatter,
  stripHtmlComments,
} from '../posts'

const raw = `---
titulo: olá, mundo
data: 2026-08-22
resumo: um primeiro texto.
tags: [meta]
---

<!-- reescrever -->

primeiro parágrafo com **negrito** e coração.

segundo parágrafo.

## um título

terceiro parágrafo.
`

describe('splitFrontmatter', () => {
  it('separa o bloco de cabeçalho do corpo', () => {
    const { frontmatter, body } = splitFrontmatter(raw)
    expect(frontmatter).toContain('titulo: olá, mundo')
    expect(frontmatter).not.toContain('primeiro parágrafo')
    expect(body.trimStart().startsWith('<!-- reescrever -->')).toBe(true)
  })

  it('aceita um arquivo sem cabeçalho nenhum', () => {
    expect(splitFrontmatter('só texto')).toEqual({ frontmatter: '', body: 'só texto' })
  })

  it('não confunde uma régua horizontal no meio do texto com o fim do cabeçalho', () => {
    const { body } = splitFrontmatter('---\ntitulo: x\n---\n\num\n\n---\n\ndois\n')
    expect(body).toContain('dois')
  })
})

describe('slugFromFilename', () => {
  it('tira o prefixo de data e a extensão', () => {
    expect(slugFromFilename('2026-08-22-como-cheguei-aqui.md')).toBe('como-cheguei-aqui')
  })
  it('deixa em paz um arquivo sem data', () => {
    expect(slugFromFilename('sobre-tudo.md')).toBe('sobre-tudo')
  })
})

describe('readingMinutes', () => {
  it('nunca devolve zero', () => expect(readingMinutes('oi')).toBe(1))
  it('cresce com o tamanho', () => {
    expect(readingMinutes('palavra '.repeat(400))).toBeGreaterThan(1)
  })
})

describe('countParagraphs', () => {
  it('conta prosa e ignora título', () => {
    expect(countParagraphs(splitFrontmatter(raw).body)).toBe(3)
  })
  it('ignora comentário html, que é andaime e não parágrafo', () => {
    expect(countParagraphs('<!-- reescrever -->\n\num parágrafo.')).toBe(1)
  })
  it('ignora bloco de código e régua', () => {
    expect(countParagraphs('```js\nx\n```\n\n---\n\num parágrafo.')).toBe(1)
  })
  it('nunca devolve zero, pra que um galho sempre tenha um galhinho', () => {
    expect(countParagraphs('')).toBe(1)
  })
})

describe('stripHtmlComments', () => {
  it('remove um comentário HTML do html renderizado', () => {
    expect(stripHtmlComments('<!-- nota do autor -->\n<p>oi</p>')).toBe('<p>oi</p>')
  })

  it('remove comentário de múltiplas linhas', () => {
    expect(stripHtmlComments('<!--\nlinha um\nlinha dois\n-->\n<p>oi</p>')).toBe('<p>oi</p>')
  })

  it('não mexe em html sem comentário', () => {
    expect(stripHtmlComments('<p>oi</p>')).toBe('<p>oi</p>')
  })
})

describe('parsePost', () => {
  it('lê o cabeçalho', () => {
    const p = parsePost(raw, '2026-08-22-ola.md')
    expect(p.titulo).toBe('olá, mundo')
    expect(p.data).toBe('2026-08-22')
    expect(p.slug).toBe('ola')
    expect(p.tags).toEqual(['meta'])
    expect(p.rascunho).toBe(false)
    expect(p.paragrafos).toBe(3)
  })

  it('a data continua string, sem virar Date no fuso da máquina de build', () => {
    expect(typeof parsePost(raw, 'x.md').data).toBe('string')
  })

  it('renderiza markdown com acento inteiro', () => {
    const p = parsePost(raw, 'x.md')
    expect(p.html).toContain('<strong>negrito</strong>')
    expect(p.html).toContain('coração')
  })

  it('marca rascunho', () => {
    expect(parsePost(raw.replace('tags:', 'rascunho: true\ntags:'), 'x.md').rascunho).toBe(true)
  })

  it('explode sem titulo, em vez de publicar um post em branco', () => {
    expect(() => parsePost('---\ndata: 2026-01-01\n---\nx', 'x.md')).toThrow(/titulo/)
  })

  it('explode sem data, porque a ordem do blog depende dela', () => {
    expect(() => parsePost('---\ntitulo: x\n---\nx', 'x.md')).toThrow(/data/)
  })

  it('explode com data em formato errado, em vez de ordenar errado em silêncio', () => {
    expect(() => parsePost('---\ntitulo: x\ndata: ontem\n---\nx', 'x.md')).toThrow(/AAAA-MM-DD/)
  })

  it('não deixa nota de andaime (comentário HTML) vazar pro html do post', () => {
    const p = parsePost(raw, 'x.md')
    expect(p.html).not.toContain('reescrever')
    expect(p.html).not.toContain('<!--')
  })

  it('preserva `<!--` literal dentro de um bloco de código, escapado pelo marked', () => {
    const comCodigo = raw.replace(
      'terceiro parágrafo.',
      'terceiro parágrafo.\n\n```html\n<!-- exemplo -->\n```',
    )
    const p = parsePost(comCodigo, 'x.md')
    expect(p.html).toContain('&lt;!-- exemplo --&gt;')
  })
})
