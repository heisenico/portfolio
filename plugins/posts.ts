/**
 * Pipeline de markdown em tempo de build.
 *
 * Lê `content/posts/*.md`, renderiza cada um pra HTML e expõe o resultado no
 * módulo virtual `virtual:posts`. O navegador recebe HTML pronto — nem o
 * parser de markdown nem o de YAML entram no bundle, porque o texto não muda
 * depois do build e mandar um parser junto seria pagar centenas de kilobytes
 * por nada.
 *
 * Toda validação aqui explode o build em vez de degradar. Um post sem título
 * ou com data mal escrita publica algo errado e silencioso; um build vermelho
 * custa trinta segundos.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { marked } from 'marked'
import { parse as parseYaml } from 'yaml'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:posts'
const RESOLVED_ID = '\0virtual:posts'
const POSTS_DIR = 'content/posts'
/** Velocidade de leitura pra prosa em português, em palavras por minuto. */
const WPM = 200
const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

export interface Post {
  slug: string
  titulo: string
  data: string
  resumo: string
  tags: string[]
  minutos: number
  html: string
  paragrafos: number
  rascunho: boolean
}

/**
 * Separa o bloco de frontmatter do corpo.
 *
 * A âncora é a *primeira* linha do arquivo: só um `---` na linha 1 abre
 * cabeçalho. Sem isso, uma régua horizontal no meio de um texto viraria
 * delimitador e comeria metade do post.
 */
export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const normalizado = raw.replace(/\r\n/g, '\n')
  if (!normalizado.startsWith('---\n')) return { frontmatter: '', body: normalizado }

  const fim = normalizado.indexOf('\n---', 3)
  if (fim === -1) return { frontmatter: '', body: normalizado }

  return {
    frontmatter: normalizado.slice(4, fim),
    body: normalizado.slice(fim + 4),
  }
}

export function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WPM))
}

/**
 * Só blocos de prosa. Título, cerca de código, régua e comentário HTML não são
 * parágrafo.
 *
 * Esse número vira a contagem de galhinhos no galho do post, então ele tem que
 * acompanhar como o texto *lê*, não quantas linhas em branco ele tem.
 */
export function countParagraphs(markdown: string): number {
  const blocos = markdown
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .filter(
      (b) =>
        !b.startsWith('#') &&
        !b.startsWith('```') &&
        !b.startsWith('---') &&
        !b.startsWith('<!--'),
    )
  return Math.max(1, blocos.length)
}

export function parsePost(raw: string, filename: string): Post {
  const { frontmatter, body } = splitFrontmatter(raw)
  const bruto = frontmatter ? (parseYaml(frontmatter) as Record<string, unknown> | null) : null
  // YAML de comentário puro parseia pra null; sem isso o acesso abaixo estoura.
  const data: Record<string, unknown> = bruto ?? {}

  if (!data['titulo']) throw new Error(`${filename}: frontmatter sem "titulo"`)
  if (!data['data']) throw new Error(`${filename}: frontmatter sem "data"`)

  const dataStr = String(data['data'])
  if (!DATA_VALIDA.test(dataStr)) {
    throw new Error(`${filename}: "data" precisa ser AAAA-MM-DD, veio "${dataStr}"`)
  }

  return {
    slug: slugFromFilename(filename),
    titulo: String(data['titulo']),
    data: dataStr,
    resumo: String(data['resumo'] ?? ''),
    tags: Array.isArray(data['tags']) ? data['tags'].map(String) : [],
    minutos: readingMinutes(body),
    html: marked.parse(body, { async: false }),
    paragrafos: countParagraphs(body),
    rascunho: data['rascunho'] === true,
  }
}

export function postsPlugin(): Plugin {
  let isProduction = false
  let projectRoot = process.cwd()

  async function loadAll(): Promise<Post[]> {
    const dir = join(projectRoot, POSTS_DIR)
    let files: string[]
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith('.md'))
    } catch {
      return []
    }
    const posts = await Promise.all(
      files.map(async (f) => parsePost(await readFile(join(dir, f), 'utf8'), f)),
    )
    return posts
      .filter((p) => !isProduction || !p.rascunho)
      .sort((a, b) => b.data.localeCompare(a.data))
  }

  return {
    name: 'posts',
    configResolved(config) {
      projectRoot = config.root
      isProduction = config.command === 'build'
    },
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : null),
    async load(id) {
      if (id !== RESOLVED_ID) return null
      return `export const posts = ${JSON.stringify(await loadAll())};`
    },
    configureServer(server) {
      // Editar um post recarrega o navegador sem reiniciar o Vite.
      server.watcher.add(join(projectRoot, POSTS_DIR))
      server.watcher.on('all', (_e, file) => {
        if (!file.endsWith('.md')) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}
