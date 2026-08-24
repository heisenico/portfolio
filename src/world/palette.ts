/**
 * A paleta do mundo, pré-inversão.
 *
 * A cena é sempre renderizada "nativa noite": tinta clara sobre preto. No
 * tema papel o passe final inverte o frame (`fx/shaders/finish.ts`), e o
 * preto daqui vira o branco do papel, a tinta clara vira tinta escura. Por
 * isso tudo aqui é escala de cinza — a única cor do site é o gato, e
 * `__tests__/palette.test.ts` garante que continue assim.
 *
 * Os dois cinzas intermediários são ponto de partida, ajustados olhando a
 * cena nos dois temas: ACES + exposição 1.22 + bloom mudam toda cor emissiva.
 * O critério: no papel, a linha em repouso lê como lápis e a crista do scan
 * como tinta sangrando; na noite, o inverso.
 */

/** Clear color e fog. Precisa ser preto puro: `0x030705` inverteria pra um branco rosado. */
export const PAPER = 0x000000
/** Crista do scan, rótulo aceso, núcleo do trail — o que sangra no papel. */
export const INK = 0xffffff
/** Linha em repouso. Era o verde. */
export const INK_REST = 0xb4b4b4
/** Chão, motes, rótulo em repouso. */
export const INK_FAINT = 0x8c8c8c
/** O gato. O único valor com cor no site inteiro. */
export const AMBER = 0xffc27a
/** `1 - AMBER`, canal a canal: o que o gato usa no papel pra sair âmbar depois da inversão. */
export const AMBER_INVERTIDO = 0x003d85
