/**
 * O que estou aprendendo, o que vem depois, e o que já aprendi.
 *
 * A seção que este site existe pra ter: um lugar honesto que muda com o tempo,
 * em vez de uma lista de conquistas que só cresce.
 *
 * Os anos aqui viram anéis no tronco da árvore — quanto mais tempo, maior o
 * anel. Por isso `desde` é obrigatório e nunca pode ser zero.
 */

export interface Aprendendo {
  nome: string
  porque: string
}

export interface Habilidade {
  nome: string
  /** Ano em que começou. Vira o raio do anel no tronco. */
  desde: number
  nota?: string
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

  jaAprendi: [
    { nome: 'surf', desde: 2014, nota: 'o mar não negocia.' },
    { nome: 'forró', desde: 2023, nota: 'dançar é a única coisa que me tira da cabeça.' },
    { nome: 'yoga', desde: 2024 },
  ] satisfies Habilidade[],
}

/** Anos completos desde que começou. Calculado, nunca escrito à mão. */
export function anosDe(habilidade: Habilidade, hoje = new Date()): number {
  return Math.max(0, hoje.getFullYear() - habilidade.desde)
}
