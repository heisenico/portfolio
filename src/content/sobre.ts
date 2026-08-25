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
  lead: '',

  secoes: [
    {
      id: 'sobre',
      titulo: 'sobre',
      corpo: [
        'eu moro no rio de janeiro. trabalho com desenvolvimento de software na base exchange, ajudo a criar uma nova bolsa de valores no Brasil.',
        'gosto muito de aprender sobre coisas novas. engenharia, design, arte, música, cinema, literatura.',
        'se estiver pelo rio e quiser trocar uma idea, me mande uma DM. adoraria tomar um café e conversar sobre criar coisas novas, fazer a web mais acessível e divertida, além de claro, IA.',
      ],
    },
    {
      id: 'essesite',
      titulo: 'esse site',
      corpo: [
        'esse site é um experimento. é uma forma de criar arte na web. espero que esteja curtindo essa passagem por aqui. é feito com typescript, three.js e vite. o código fonte está no github.',
        '',
      ],
    },
  ] satisfies Secao[],

  convite: 'pra trabalho criativo, de engenharia a design:',
}
