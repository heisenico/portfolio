# Tinta sobre papel — identidade visual

Data: 2026-08-23
Status: Aprovado (iniciativa DHARMA, hatch de design)
Referência: maryrosecook.com — só tipografia e paleta. Layout, estrutura e
conteúdo escrito do site ficam como estão. Nenhum arquivo em `src/content/` ou
`content/posts/` é tocado por este trabalho.

## Propósito

Trocar a identidade visual do site — cores primárias e tipografia — sem trocar
o núcleo: a árvore, os cards, o gato, e a cor do gato. A referência é
monocromática (preto puro sobre branco puro, um cinza para filetes, Gill Sans em
dois pesos leves, zero negrito, zero sombra, zero cor de destaque). O site, por
sua vez, é uma cena Three.js desenhada com `AdditiveBlending` sobre fundo
quase-preto, e o bloom é o que faz linhas de 1px lerem como luz. Aditivo sobre
branco satura em branco: a árvore some. Então "preto sobre branco" aqui não é
trocar dois tokens — é decidir o que acontece com o mundo.

A decisão: **o mundo continua sendo um scan, mas passa a ser scaneado em
tinta.** O pipeline renderiza a cena exatamente como hoje e o passe final
inverte o frame. Luz vira tinta; brilho de bloom vira sangria de tinta no
papel. Dark mode é a mesma cena sem inverter.

Sucesso: a intro continua lendo como um scan (agora de tinta); o gato continua
legível e continua `#ffc27a`; todo texto passa AA com folga contra o pior caso
de fundo; o site respeita `prefers-color-scheme` e `prefers-contrast`; nada do
contrato do mundo (`README.md`, "Adding a bespoke world") muda além da cláusula
de cor; `npm test`, `npm run typecheck` e `npm run build` passam.

## Decisões tomadas no brainstorm

| Pergunta | Decisão |
| --- | --- |
| O fundo branco vale para o mundo 3D? | Sim. Papel total, mundo invertido no passe final. |
| Como o gato aparece no papel? | Corpo de tinta preta, forro `#ffc27a` exato, arestas em tinta. |
| Dark mode? | Papel por padrão; noite se o SO pedir. Sem toggle na página. |
| Fonte? | Cabin Variable self-hosted, para todo mundo. Peso 400 em tudo. |
| Mundos dos posts continuam com matiz por tag? | Não. Tinta monocromática; a deriva vira pressão da pena. |
| Preto puro ou suavizado? | `#000` sobre `#fff`, mais `prefers-contrast: less`. |
| Entrelinha do corpo? | 1.4. |
| Âmbar fora do gato? | Não. O gato é a única cor do site. |

## 1. Tokens

`src/styles/tokens.css` é a única fonte de verdade do DOM. Fica assim:

```css
:root {
  /* papel */
  --paper: #ffffff;
  --ink: #000000;      /* todo texto, links, foco, e a árvore */
  --rule: #bbbbbb;     /* filetes de 1px; nunca texto */
}

@media (prefers-color-scheme: dark) {
  :root { --paper: #000000; --ink: #ffffff; --rule: #444444; }
}

@media (prefers-contrast: less) {
  :root { --paper: #fafafa; --ink: #1a1a1a; }
}
@media (prefers-contrast: less) and (prefers-color-scheme: dark) {
  :root { --paper: #0a0a0a; --ink: #e6e6e6; }
}
```

`prefers-contrast: less` suaviza só os tokens do DOM: o papel do mundo continua
`#ffffff`/`#000000` puros, porque o canvas limpa para `PAPER` e a inversão do
passe final é binária. É aceitável — a halação que incomoda quem pede menos
contraste é a do texto, e o texto é justamente o que os tokens governam.

Somem: `--bg`, `--bg-card`, `--bg-lifted` (já mortos, zero `var()`),
`--bg-deep` (vira `--paper`), `--ink-dim`, `--ink-faint` (a referência tem um
preto só — hierarquia por tamanho, não por cor), `--green`, `--green-hot`,
`--track-tight`, `--track-snug` (tracking negativo é artefato do Geist), e
`--amber` — nenhum elemento DOM usa âmbar, então o valor mora só em
`palette.ts` (abaixo), sem a duplicata órfã que existe hoje entre
`tokens.css:31` e `Cat.ts:45`. `--rule` deixa de ser `color-mix` e vira o
cinza sólido da referência.

Contrastes (WCAG 2.x, verificados por script): `#000`/`#fff` 21:1;
`#1a1a1a`/`#fafafa` 16.5:1; `#ffc27a` sobre `#000` 13.25:1; `#ffc27a` sobre
`#fff` 1.58:1 — por isso o âmbar nunca encosta no papel (ver §5).

Duplicatas fora do CSS seguem os tokens:

- `index.html`: `<meta name="color-scheme" content="light dark">`; dois
  `<meta name="theme-color">` com `media="(prefers-color-scheme: light)"` →
  `#ffffff` e `dark` → `#000000`; `mask-icon color` → `#000000`.
- `public/favicon.svg`: traço `currentColor`-equivalente com `<style>` interno
  e `@media (prefers-color-scheme: dark)`; placa transparente.

### Paleta do mundo (JS)

Hoje existe uma segunda paleta escondida em constantes JS (`Ground.ts:32`,
`Motes.ts:40`, `ScanPulse.ts:26`, `PointerTrail.ts:57,90`,
`TrunkRings.ts:48-49`, `ScanReveal.ts:40-41`, `Fireflies.ts:81`,
`BranchLabels.ts:119-120,184`, `Stage.ts:20`). Ela colapsa num módulo novo,
`src/world/palette.ts`, com valores **pré-inversão** em escala de cinza:

```ts
export const PAPER = 0x000000        // clear color e fog; vira branco no papel
export const INK = 0xffffff          // crista do scan, rótulo aceso, núcleo do trail
export const INK_REST = 0xb4b4b4     // linha em repouso (substitui o verde)
export const INK_FAINT = 0x8c8c8c    // chão, motes, rótulo em repouso
export const AMBER = 0xffc27a        // o gato; único valor que o tema pré-inverte
```

A cena é sempre renderizada "nativa noite" (tinta clara sobre preto). O tema
só decide se o frame é invertido. Os únicos uniforms dependentes de tema são
os do gato (§5). `BG_COLOR` **precisa** ser `0x000000`: o `0x030705` atual
inverteria para um branco rosado.

Os valores exatos de `INK_REST`/`INK_FAINT` são ponto de partida; o ajuste
final é feito olhando a cena nos dois temas, porque ACES + exposição 1.22 +
bloom (limiar 0.1) alteram toda cor emissiva. O critério: no papel, a linha em
repouso lê como lápis (cinza médio), a crista do scan lê como tinta preta
sangrando; na noite, o inverso.

## 2. Tipografia

- Sai `@fontsource-variable/geist`; entra `@fontsource-variable/cabin`
  (OFL, eixos wght 400–700 e wdth, latin). `@fontsource-variable/geist-mono`
  fica para código.
- `--font-sans: 'Cabin Variable', 'Gill Sans', 'Gill Sans MT', Calibri,
  'Trebuchet MS', sans-serif`. Cabin é a fonte livre inspirada em Gill Sans;
  self-hosted, o site é idêntico em qualquer sistema e os rótulos em canvas da
  árvore (`BranchLabels.ts:150-153`, que lê `--font-sans`) medem igual em
  toda máquina.
- **Peso 400 em tudo.** Cabin não tem Light; a referência diz "nenhum
  negrito, hierarquia do tamanho". `FONTE_PESO` em `BranchLabels.ts:131` vira
  400. `font-synthesis-weight: none` fica.
- Escala em `rem`, para zoom e tamanho de fonte do usuário funcionarem:

| Token | Valor | px | Uso | Detalhe |
| --- | --- | --- | --- | --- |
| `--text-h1` | `1.8125rem` | 29 | nome/título do site, h1 de post | `letter-spacing: 1px` |
| `--text-h2` | `1.5rem` | 24 | seção | filete `1px var(--rule)` acima, `padding-top: 9px` |
| `--text-h3` | `1.25rem` | 20 | subseção | `margin-bottom: 6px` |
| `--text-body` | `1.0625rem` | 17 | corpo, links, lead | `line-height: 1.4`, `margin-bottom: 13px` |
| `--text-small` | `0.9375rem` | 15 | datas, notas de link, nav, rótulos de grupo | única exceção abaixo da referência: a 17px a estrutura incharia |

- `--text-xs/sm/base/md/lg/xl/2xl` somem; os `clamp()` também. Títulos são
  discretos, quase do tamanho do texto — esse é o caráter.
- Entrelinha: corpo 1.4 (a referência usa 1.26, mas aqui o texto flutua sobre
  uma cena que se mexe; WCAG 1.4.8 AAA pede ≥ 1.5 e 1.4 é o meio-termo que
  ainda lê apertado). Títulos 1.15. Nada no layout pode depender de altura
  fixa de linha: com `line-height: 1.5` forçado pelo usuário (WCAG 1.4.12)
  nada corta.
- Sem `text-transform`. A regra da caixa-baixa (`caixa-baixa.test.ts`) não
  muda.

## 3. O mundo: inversão no passe final

`src/fx/shaders/finish.ts` ganha `uInvert: 0 | 1` e `uVignette` passa a ser
ajustado por tema. Ordem no fragment shader:

1. aberração cromática (como hoje);
2. `color = mix(color, 1.0 - color, uInvert);`
3. vinheta — `uVignette` é `0.0` no papel (referência: zero sombra) e `0.85`
   na noite;
4. grão (como hoje; no papel vira textura de papel).

A inversão entra **antes** da vinheta e do grão para que os dois operem no
espaço de exibição final. A aberração pré-inversão troca as franjas por suas
complementares; é imperceptível e não vale um caminho separado.

Fog: `FogExp2(PAPER)` — dissolve para o preto pré-inversão, que é o papel
pós-inversão. Nada muda além da constante.

`#veil` (`base.css:48-59`) usa `var(--paper)`. No papel a intro é: papel
branco, o pulso desenha a árvore em tinta.

Custo: um `mix` por fragmento no passe que já existe. Nenhum render target
novo para a inversão.

## 4. Superfícies e DOM

- `.material` (`glass.css`): `background: color-mix(in srgb, var(--paper) 84%,
  transparent)` — vidro fosco branco. `border: 1px solid var(--rule)`. Raio
  14px mantido. O `::before` de realce no topo sai (zero sombra, zero realce).
  As três camadas de progressive enhancement (`.lg-refract`, `.lg-fallback`,
  `.lg-no-backdrop`) ficam; `.lg-no-backdrop` vira `paper 94%`.
  Pior caso de contraste: tinta pura atrás do card a 84% de papel dá
  `#d6d6d6`; `#000` sobre isso é 14.5:1.
- Links: `color: inherit; text-decoration: underline; text-decoration-thickness:
  1px; text-underline-offset: 2px`. Sem cor de hover. O `--green 40%` dos
  sublinhados (`ui.css:310`, `prose.css:88`) vira `currentColor`.
- Foco: `:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px }`.
- Seleção: `background: var(--ink); color: var(--paper)`.
- Nav pill (`ui.css:440-493`): fundo `color-mix(var(--paper) 72%)`, thumb
  `color-mix(var(--ink) 8%)` com borda `color-mix(var(--ink) 24%)`.
- Ponto ativo da agenda (`ui.css:198-199`): `var(--ink)`.
- Régua do blockquote (`prose.css:123`): `var(--rule)`.
- Filetes de seção (`ui.css:234,266,332`): `1px solid var(--rule)`, com o
  `padding-top: 9px` da referência onde o h2 encosta no filete.
- Todo `color: var(--ink-dim | --ink-faint)` vira `var(--ink)`. Onde a
  hierarquia era só cor (texto secundário no mesmo tamanho do primário), ela
  passa a ser tamanho: o secundário vai para `--text-small`.
- `.noscript` (`base.css:85-104`): mesmos tokens; e corrige de passagem o
  `var(--step)` indefinido em `base.css:96` (a declaração é inválida hoje).

## 5. O gato

`#ffc27a` exato nos dois temas. Nenhum outro elemento do site usa âmbar — no
mundo bespoke `content/worlds/como-cheguei-aqui.ts`, `AMBAR` e
`COR_AMBAR_QUENTE` (linhas 51, 60, 66, 763-764) viram tons de tinta.

**Noite (como hoje):** corpo `0x000000` (era `0x07160f`, esverdeado), rim
`AMBER`, arestas `AMBER` aditivas, gato na passada principal, halo âmbar do
bloom. Normal-blended, pelo motivo já documentado em `cat.ts:49-52`.

**Papel:** corpo tinta preta, forro âmbar lido contra o corpo (13.25:1), arestas
em tinta. Como o frame é invertido, `Cat.setTema('papel')` pré-inverte os
uniforms: `uColor = 0xffffff` (→ `#000`), `uRim = 0x003d85` (→ `#ffc27a`), e a
`edgeMaterial` vira `INK` aditiva (→ tinta preta).

O problema: um corpo claro pré-inversão é a maior área brilhante da cena, e o
bloom (limiar 0.1, força 0.92, raio 0.62) o transformaria numa mancha escura
no papel. Solução: o gato vive numa `Layer` própria (`CAT_LAYER`). No papel,
`Post` desabilita essa layer na `RenderPass` principal e adiciona uma segunda
`RenderPass(scene, camera)` com `clear = false` e a câmera restrita à
`CAT_LAYER`, posicionada **depois do bloom e antes do `OutputPass`** — o gato
recebe tone mapping e inversão, mas não bloom. Na noite, a layer volta para a
passada principal e a passada extra é desabilitada.

Degradação aceita no papel: a passada extra não tem o depth da cena, então
galhos *na frente* do gato deixam de ocluí-lo. Na pose atual isso é raro.

`CAT_COLOR`/`CAT_RIM` deixam de ser exportados de `Cat.ts`; vêm de
`palette.ts`.

## 6. Mundos dos posts: matiz vira pressão

Hoje `hueDaTag`/`hueEnvelope` (`PostWorld.ts:87-124`) derivam o tom de 150°
(verde) para o matiz do primeiro tag, ±70°, e voltam. Em tinta monocromática
a deriva passa a ser **pressão da pena**: cada assunto tem uma mão mais leve ou
mais pesada.

- `pressaoDaTag(tag): number` — mesmo hash FNV-1a, mas devolve um ganho em
  `[0.8, 1.3]`; `undefined` → `1.0`.
- `pressaoEnvelope(progress, pressao): number` — mesmo envelope
  (`HUE_ENTRA_ATE = 0.15`, `HUE_SAI_DE = 0.8`, `HUE_VERDE_DESDE = 0.97`,
  renomeados para `PRESSAO_*`), interpolando de `1.0` para `pressao` e de
  volta.
- O valor multiplica `uGain` do galhinho (`twig.ts:73`). `uRestColor` e
  `uEdgeColor` ficam fixos em `INK_REST`/`INK`; `setHSL` some.
- Sob `reducedMotion`, o snap continua igual (`PostWorld.ts:305-315`).

Contrato do mundo (`README.md`, cláusula 3) passa a dizer:

> **Tinta entra, tinta sai.** A linha começa em `INK_REST` com ganho `1.0` e
> pode variar de peso enquanto o leitor está dentro do post, mas volta ao
> ganho `1.0` em `progress >= 0.97`. Matiz não deriva: o mundo é
> monocromático, e a única cor do site é o gato.

Testes em `PostWorld.test.ts` (`hueDaTag`, `hueEnvelope`) são reescritos para
`pressaoDaTag`/`pressaoEnvelope` com as mesmas propriedades: determinismo,
faixa limitada, tags distintas dão pressões distintas, `1.0` em `0` e a partir
de `0.97`.

No mundo bespoke: `VERDE`/`VERDE_QUENTE` → `INK_REST`/`INK`; a deriva "quente"
da rua (`DERIVA_QUENTE`, linhas 763-764) deriva para `INK` (mais pesado) em vez
de âmbar; o `clarao` (linha 720) usa `INK` — no papel é um borrão de tinta, na
noite um clarão — com o mesmo teto de opacidade e rate limit já raciocinados
para WCAG 2.3.1 (`.superpowers/TODO-milestone-c.md:75`), porque a inversão não
altera a magnitude da variação de luminância.

## 7. Tema

`src/core/Quality.ts` ganha `tema: 'papel' | 'noite'` no mesmo padrão de
`reducedMotion` (`Quality.ts:93-109`): função `readTema()` sobre
`matchMedia('(prefers-color-scheme: dark)')`, valor injetável pelo construtor
para teste, e um `onTema(listener)` ligado ao evento `change` da media query,
para que trocar a aparência do SO com o site aberto troque o tema ao vivo.

Consumidores: `Post.setTema()` (uInvert, uVignette, layer do gato) e
`Cat.setTema()` (uniforms pré-invertidos). `main.ts` liga os dois no boot e
no `onTema`. O CSS não precisa de JS: é `@media` em `tokens.css`.

Sem toggle na página: a referência não tem chrome nenhum e o SO já é o
toggle. Sem `localStorage`.

## 8. Acessibilidade

- Contraste: todo texto é `--ink` sobre `--paper` (21:1) ou sobre card (pior
  caso 14.5:1). Foco 21:1. `prefers-contrast: less` atendido (§1) — no DOM, que
  é onde ele importa: o mundo atrás da página segue em papel puro, sem versão
  suavizada, porque a inversão do passe final não tem meio-termo.
- Tamanho em `rem`, entrelinha 1.4, layout sobrevive a `line-height: 1.5`
  forçado.
- Sem `text-transform`; a regra da caixa-baixa fica.
- `prefers-reduced-motion`: nada muda — inversão não é movimento. Tudo que
  já existe (`Quality.reducedMotion` e seus consumidores) fica.
- Novo teste automatizado, `src/styles/__tests__/contraste.test.ts`: lê
  `tokens.css`, calcula WCAG para os pares ink/paper (ambos os temas e
  `prefers-contrast: less`), ink sobre card no pior caso (tinta pura a 84% de
  papel), foco sobre paper, e falha abaixo de 4.5:1 (texto) e 3:1 (foco). A
  tabela de contraste deixa de ser um markdown que ninguém roda.
- Fora do escopo desta hatch, anotado para uma hatch de acessibilidade:
  skip link para `#ui`, `aria-live` na troca de rota, foco após navegação, e
  o hover-dim de `.paixao` sem equivalente de teclado. Some-se a isso o texto
  do hero (`.hero`, `HomePage.ts`) e a deixa de rolagem (`.cue`): os dois
  pousam direto no canvas, não num card, então o fundo deles é o mundo
  invertido — linhas de tinta e sangria de bloom — e não papel. Estrutura que
  já era assim antes desta hatch; fica para ser revista lá.

## 9. Testes e verificação

Unitários (Vitest, sem WebGL):

- `PostWorld.test.ts`: `pressaoDaTag`/`pressaoEnvelope` (§6).
- `Quality.test.ts`: `tema` lê a media query injetada; `onTema` dispara na
  mudança.
- `contraste.test.ts` (§8).
- `caixa-baixa.test.ts`, `BranchLabels.test.ts` e o resto continuam passando
  sem edição (nenhum pina cor).

`npm run typecheck` e `npm run build` limpos.

No browser (Chrome, via MCP), nos dois temas trocando a aparência do macOS:

- intro em t≈0.5s, 1.5s, 3s e repouso — o scan lê como tinta no papel e como
  luz na noite;
- gato pousado: preto com forro âmbar no papel, sem mancha de bloom ao redor;
  como hoje na noite;
- `/blog` com rótulos legíveis; um post até `progress >= 0.97` com a pressão
  voltando a 1.0;
- console sem erros nem avisos WebGL; 375×812 sem overflow horizontal;
- `prefers-contrast: less` forçado nas DevTools mostra `#1a1a1a`/`#fafafa`.

## 10. Fora de escopo

- Qualquer texto em `src/content/` e `content/posts/`. As edições locais não
  commitadas em `site.ts`/`sobre.ts` são do autor e não entram em nenhum
  commit deste trabalho.
- Mudança de layout, estrutura de páginas ou comportamento do gato.
- Toggle de tema na página.
- Skip link e demais itens de a11y listados em §8 — hatch própria.
- Âmbar em qualquer lugar que não seja o gato.

## 11. Riscos

- **Bloom no papel.** A crista do scan renderiza acima de 1.0 e sangra; no
  papel a sangria é escura. Pode ficar pesada demais — `BLOOM_STRENGTH` e
  `INK_REST` são os dois botões, ajustados olhando.
- **Cabin 400 para tudo.** Sem Light, corpo e título têm o mesmo peso. Se a
  hierarquia não segurar só no tamanho, o recurso é `letter-spacing` nos
  títulos, nunca peso.
- **Depth do gato no papel.** Degradação aceita (§5). Se incomodar, a
  alternativa é copiar o depth buffer da passada principal para a passada do
  gato — fora deste spec.
- **Refração sobre branco.** O `feDisplacementMap` entorta um fundo quase
  todo branco; o efeito fica mais sutil que hoje. Aceito: vidro raro e com
  propósito.
