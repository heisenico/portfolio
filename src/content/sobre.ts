/**
 * A página inicial em prosa.
 *
 * Escrita pra ser lida rápido e sem esforço. Frase simples, sem virar aforismo
 * — a versão anterior caía sempre no mesmo ritmo de "afirmação séria, negação
 * curta", que soa esperto na primeira vez e cansa na terceira.
 */

export interface Secao {
  id: string
  titulo: string
  corpo: string[]
}

export const sobre = {
  lead: 'cuido de arquitetura e direção de front-end na base exchange, com react, next.js e javascript.',

  secoes: [
    {
      id: 'sobre',
      titulo: 'sobre',
      corpo: [
        'trabalho com interface há tempo suficiente pra saber que a decisão de arquitetura e a decisão de design quase sempre são a mesma decisão, tomada duas vezes.',
        'boa parte da minha carreira aconteceu dentro de empresa, em time, resolvendo problema de gente de verdade. é esse tipo de trabalho que eu gosto de fazer.',
      ],
    },
    {
      id: 'fora',
      titulo: 'fora do trabalho',
      corpo: [
        'leio, vejo filme e passo tempo demais aprendendo coisa que eu ainda não sei fazer.',
        'não uso rede social. mantenho um canal no youtube que funciona como diário, e onde também falo de javascript.',
      ],
    },
  ] satisfies Secao[],

  convite: 'pra trabalho criativo, de engenharia a design:',
}
