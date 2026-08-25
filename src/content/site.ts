export interface Link {
  rotulo: string
  href: string
  nota?: string
}

export const site = {
  perfil: {
    nome: 'nicholas ferrer alencar',
    papel: 'especialista em desenvolvimento - criatividade, design e tecnologia',
    lugar: 'carioca, entre a roça e a cidade',
    empresa: 'base exchange - fazendo a nova bolsa de valores do brasil',
  },

  nav: { home: 'início', blog: 'blog' },

  rodape: {
    nota: 'o gato é procedural e não gosta de ser observado. obrigado e namaste 🙏',
    cue: 'role',
  },

  links: [
    {
      rotulo: 'youtube',
      href: 'https://www.youtube.com/@heisenico',
      nota: 'um diário digital. também falo de javascript e faço umas playlists legais!',
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
      nota: 'a parte formal',
    },
    {
      rotulo: 'github',
      href: 'https://github.com/heisenico',
      nota: 'onde este site mora.',
    },
  ] satisfies Link[],
}
