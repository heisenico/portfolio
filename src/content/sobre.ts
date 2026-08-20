/**
 * A página inicial em prosa.
 *
 * Rascunho: a estrutura é o que importa aqui. Reescreva com as suas palavras
 * sem medo — nada no layout depende destas frases.
 */

export interface Secao {
  id: string
  titulo: string
  corpo: string[]
}

export const sobre = {
  manchete: 'Saí da cidade pra ficar perto do silêncio.',
  sub: 'Continuo escrevendo código. Só que agora tem mais passarinho do lado de fora.',

  secoes: [
    {
      id: 'quem',
      titulo: 'Quem eu sou',
      corpo: [
        'Sou o Nicholas, carioca. Engenheiro de software, remoto, morando no interior — troquei a cidade por um lugar onde dá pra ouvir o vento.',
        'Sou uma pessoa criativa que gosta de programar. As duas coisas na mesma frase, sem hierarquia entre elas.',
      ],
    },
    {
      id: 'trabalho',
      titulo: 'O que eu faço',
      corpo: [
        'Lidero arquitetura e direção de front-end na Base Exchange, com React, Next.js e JavaScript.',
        'A parte que me interessa é onde a decisão de arquitetura e a decisão de design são a mesma decisão — só que ninguém percebeu ainda.',
      ],
    },
    {
      id: 'gosto',
      titulo: 'O que eu gosto',
      corpo: [
        'Ler. Ver filme. Aprender coisa que eu ainda não sei fazer.',
        'Não tenho rede social — parei de gostar. Sobrou um canal no YouTube que uso como diário, onde também falo de JavaScript e guardo playlist boa.',
      ],
    },
  ] satisfies Secao[],

  convite: {
    titulo: 'Vamos fazer alguma coisa?',
    corpo:
      'Se você quer trabalho criativo — de engenharia a design, ou qualquer coisa no meio — me chama.',
  },
}
