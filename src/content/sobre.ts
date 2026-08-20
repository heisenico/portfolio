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
  lead: 'Cuido de arquitetura e direção de front-end na Base Exchange, com React, Next.js e JavaScript.',

  secoes: [
    {
      id: 'sobre',
      titulo: 'Sobre',
      corpo: [
        'Trabalho com interface há tempo suficiente pra saber que a decisão de arquitetura e a decisão de design quase sempre são a mesma decisão, tomada duas vezes.',
        'Boa parte da minha carreira aconteceu dentro de empresa, em time, resolvendo problema de gente de verdade. É esse tipo de trabalho que eu gosto de fazer.',
      ],
    },
    {
      id: 'fora',
      titulo: 'Fora do trabalho',
      corpo: [
        'Leio, vejo filme e passo tempo demais aprendendo coisa que eu ainda não sei fazer.',
        'Não uso rede social. Mantenho um canal no YouTube que funciona como diário, e onde também falo de JavaScript.',
      ],
    },
  ] satisfies Secao[],

  convite: 'Pra trabalho criativo, de engenharia a design:',
}
