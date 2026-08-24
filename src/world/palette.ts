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
/**
 * O que o gato usa no papel para sair `#ffc27a` **na tela**.
 *
 * Não é o complemento sRGB de `AMBER`: entre o uniform e o pixel existe ACES
 * (exposição 1.22) e a codificação sRGB, e só depois o passe final inverte.
 * ACES não é simétrico sob `1 - x`, então o complemento ingênuo (`0x003d85`)
 * chegava a `#ffc864` — seis níveis de verde a mais, o âmbar puxando para
 * amarelo. Este valor foi resolvido rodando o pipeline ao contrário
 * (`__tests__/aces.ts`); acerta os três canais na mosca, e
 * `__tests__/palette.test.ts` o mantém honesto.
 *
 * Na noite o gato usa `AMBER` cru, que o mesmo ACES entrega como ≈`#ebd4a5` a
 * fresnel cheio — lavado de propósito, é como o autor ajustou a cena.
 */
export const AMBER_INVERTIDO = 0x1e4173
