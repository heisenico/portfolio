/**
 * Identidade e textos de moldura.
 *
 * Todo texto visível do site mora em `src/content/`. Trocar a cópia é editar um
 * arquivo — nenhuma marcação ou estilo depende das strings.
 */

export interface Link {
  rotulo: string
  href: string
  /** Uma linha dizendo por que esse link existe. */
  nota?: string
}

export const site = {
  perfil: {
    nome: 'Nicholas Ferrer',
    papel: 'Engenheiro de software',
    lugar: 'Do Rio, morando no interior',
    empresa: 'Base Exchange',
  },

  nav: { home: 'Início', blog: 'Blog' },

  rodape: {
    nota: 'Uma árvore, duas páginas. O gato é procedural e não gosta de ser observado.',
    cue: 'Role',
  },

  /**
   * Sem rede social por escolha. Sobraram os lugares que dizem alguma coisa de
   * verdade sobre o que ele lê, assiste e faz — e um canal que ele usa como
   * diário.
   */
  links: [
    {
      rotulo: 'YouTube',
      href: 'https://www.youtube.com/@heisenico',
      nota: 'Meu diário. Também falo de JavaScript e guardo playlist boa.',
    },
    {
      rotulo: 'Goodreads',
      href: 'https://www.goodreads.com/user/show/203531558-nicholas',
      nota: 'O que eu ando lendo.',
    },
    {
      rotulo: 'Letterboxd',
      href: 'https://letterboxd.com/nicholasferrer/',
      nota: 'O que eu ando assistindo.',
    },
    {
      rotulo: 'LinkedIn',
      href: 'https://www.linkedin.com/in/ferrernicholas/',
      nota: 'A parte formal.',
    },
    {
      rotulo: 'GitHub',
      href: 'https://github.com/heisenico',
      nota: 'Onde este site mora.',
    },
    {
      rotulo: 'E-mail',
      href: 'mailto:nicholasferrer@hotmail.com',
      nota: 'Pra falar de trabalho criativo.',
    },
  ] satisfies Link[],
}
