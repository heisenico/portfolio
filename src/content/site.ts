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
    nome: 'nicholas ferrer alencar',
    papel: 'engenheiro de software',
    /** Carioca, e dividido entre os dois lugares — sem fazer disso um tema. */
    lugar: 'carioca, entre a roça e a cidade',
    empresa: 'base exchange',
  },

  nav: { home: 'início', blog: 'blog' },

  rodape: {
    nota: 'o gato é procedural e não gosta de ser observado.',
    cue: 'role',
  },

  /**
   * Sem rede social por escolha. Sobraram os lugares que dizem alguma coisa de
   * verdade sobre o que ele lê, assiste e faz — e um canal que ele usa como
   * diário.
   */
  links: [
    {
      rotulo: 'youtube',
      href: 'https://www.youtube.com/@heisenico',
      nota: 'meu diário. também falo de javascript e guardo playlist boa.',
    },
    {
      rotulo: 'goodreads',
      href: 'https://www.goodreads.com/user/show/203531558-nicholas',
      nota: 'o que eu ando lendo.',
    },
    {
      rotulo: 'letterboxd',
      href: 'https://letterboxd.com/nicholasferrer/',
      nota: 'o que eu ando assistindo.',
    },
    {
      rotulo: 'linkedin',
      href: 'https://www.linkedin.com/in/ferrernicholas/',
      nota: 'a parte formal.',
    },
    {
      rotulo: 'github',
      href: 'https://github.com/heisenico',
      nota: 'onde este site mora.',
    },
    {
      rotulo: 'e-mail',
      href: 'mailto:nicholasferrer@hotmail.com',
      nota: 'pra falar de trabalho criativo.',
    },
  ] satisfies Link[],
}
