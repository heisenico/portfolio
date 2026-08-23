/**
 * O que estou aprendendo e o que vem depois.
 *
 * A parte do site que muda com o tempo, que é o que faz valer uma segunda
 * visita. O que ele já sabe fazer mora em `paixoes.ts` — separado porque é uma
 * lista que só cresce, e esta aqui é uma lista que se substitui.
 */

export interface Aprendendo {
  nome: string
  porque: string
}

export const aprendizado = {
  agora: {
    nome: 'edição de vídeo no premiere',
    porque: 'pra contar melhor as coisas que eu faço.',
  } satisfies Aprendendo,

  depois: {
    nome: 'tocar sax',
    porque: 'porque sim.',
  } satisfies Aprendendo,
}
