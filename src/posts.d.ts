declare module 'virtual:posts' {
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
  /** Mais novo primeiro. Rascunho só aparece em dev. */
  export const posts: Post[]
}
