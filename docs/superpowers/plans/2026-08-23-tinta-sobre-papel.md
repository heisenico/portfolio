# Tinta sobre papel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a identidade visual do site para preto sobre branco com uma
fonte só, sem trocar o núcleo — a árvore, os cards, o gato e a cor do gato —
e com o site respeitando `prefers-color-scheme` e `prefers-contrast`.

**Architecture:** A cena Three.js continua renderizada como hoje (linhas
aditivas sobre preto, bloom, ACES) e o passe final inverte o frame quando o
tema é papel: luz vira tinta. Toda cor do mundo colapsa num módulo
`palette.ts` em escala de cinza; o gato é o único valor com cor e ganha uma
layer própria renderizada depois do bloom no papel, para não virar mancha.
O DOM troca de tokens: `--paper`, `--ink`, `--rule`, Cabin em peso 400, escala
29/24/20/17(+15) em `rem`. Os mundos dos posts trocam deriva de matiz por
deriva de pressão (`uGain`).

**Tech Stack:** Three.js 0.185 (vanilla), Vite 8, TypeScript 7, Vitest 4,
`@fontsource-variable/cabin` 5.3.0 + `@fontsource-variable/geist-mono`.

**Spec:** `docs/superpowers/specs/2026-08-23-tinta-sobre-papel-design.md`.
Leia inteiro antes de começar; o plano argumenta a partir dele e não repete
os porquês.

---

## Global Constraints

Todo requisito de toda tarefa inclui implicitamente esta seção.

- **Conteúdo escrito intocado.** Nada em `src/content/` ou `content/posts/`
  muda. O working tree tem edições locais não commitadas do autor em
  `src/content/site.ts` e `src/content/sobre.ts`: **nunca** as inclua num
  `git add`. Sempre `git add` por caminho explícito, nunca `git add -A` ou
  `git add .`.
- **A única cor do site é o gato: `#ffc27a`.** Nenhum outro hex com croma
  entra em CSS, JS ou GLSL. Todo tom do mundo é cinza (`r == g == b`).
- **Sem negrito.** `font-weight: 400` em tudo, DOM e canvas. Sem
  `text-transform` (a regra da caixa-baixa, `caixa-baixa.test.ts`, fica).
- **Tamanhos em `rem`**, nunca `px`, para texto.
- **Zero sombra, zero realce, zero cor de hover.** Hover/foco em links muda
  só a espessura do sublinhado.
- **`git add` por caminho explícito** e commit ao fim de cada tarefa, com
  mensagem em português no estilo dos commits recentes (`feat:`, `fix:`,
  `test:`, `docs:`).
- **Depois de cada tarefa:** `npm test`, `npm run typecheck`. Antes do
  commit final: `npm run build`.
- Comentários de código em português, como o resto dos arquivos recentes.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Tarefa |
| --- | --- | --- |
| `src/styles/tokens.css` | Paleta e escala do DOM, os dois temas, `prefers-contrast` | 1 |
| `src/styles/__tests__/contraste.test.ts` | **Novo.** Lê `tokens.css` e falha abaixo de AA | 1 |
| `package.json`, `package-lock.json` | Geist → Cabin | 1 |
| `src/styles/base.css`, `glass.css`, `ui.css`, `prose.css` | O DOM em tinta sobre papel | 2 |
| `index.html`, `public/favicon.svg` | Meta de tema e favicon nos dois esquemas | 2 |
| `src/ui/Nav.ts` | Só um comentário que cita Geist | 2 |
| `src/world/palette.ts` | **Novo.** Paleta do mundo, pré-inversão, em cinza + o âmbar | 3 |
| `src/world/__tests__/palette.test.ts` | **Novo.** Cinza em tudo menos o âmbar; nenhuma cor solta em `world/` | 3, 7 |
| `src/core/Stage.ts`, `src/world/{ScanReveal,ScanPulse,Ground,Motes,PointerTrail,TrunkRings,Fireflies,BranchLabels,Cat}.ts` | Cores hardcoded → `palette.ts` | 3 |
| `src/core/Quality.ts`, `src/core/__tests__/Quality.test.ts` | `tema`, `setTema`, `onTema` | 4 |
| `src/fx/shaders/finish.ts`, `src/fx/Post.ts`, `src/main.ts` | `uInvert`, vinheta por tema, listener da media query | 5 |
| `src/world/Cat.ts`, `src/fx/Post.ts`, `src/main.ts` | `CAT_LAYER`, `Cat.setTema`, `CatPass` pós-bloom | 6 |
| `src/world/PostWorld.ts`, `src/world/__tests__/PostWorld.test.ts`, `content/worlds/como-cheguei-aqui.ts` | Matiz → pressão | 7 |
| `README.md` | Contrato do mundo, cláusula 3 | 8 |

---

### Task 1: Tokens, fonte e o teste de contraste

**Files:**
- Modify: `src/styles/tokens.css` (arquivo inteiro)
- Create: `src/styles/__tests__/contraste.test.ts`
- Modify: `package.json`, `package-lock.json` (via npm)

**Interfaces:**
- Produces (CSS): `--paper`, `--ink`, `--rule`, `--font-sans`, `--font-mono`,
  `--text-h1`, `--text-h2`, `--text-h3`, `--text-body`, `--text-small`,
  `--leading-body`, `--leading-title`, `--space-1..9`, `--gutter`,
  `--measure`, `--radius`, `--z-canvas`, `--z-content`, `--z-veil`, `--z-cue`.
  Toda tarefa seguinte usa **só** estes nomes.
- Estrutura que o teste espera em `tokens.css`: um `:root { ... }` de topo
  e, para cada `@media`, um único `:root { ... }` dentro.

Estado ao fim desta tarefa: `npm test` e `npm run build` passam, mas o site
fica visualmente errado até a Task 2 (as folhas de estilo ainda pedem tokens
que não existem mais). Isso é esperado — a Task 2 vem logo em seguida.

- [ ] **Step 1: Trocar a fonte no npm**

```bash
npm uninstall @fontsource-variable/geist
npm install @fontsource-variable/cabin@5.3.0
```

Confira: `ls node_modules/@fontsource-variable/` mostra `cabin` e
`geist-mono`, não `geist`.

- [ ] **Step 2: Escrever o teste de contraste (vai falhar)**

Crie `src/styles/__tests__/contraste.test.ts`:

```ts
/**
 * A tabela de contraste, como teste em vez de markdown.
 *
 * Lê `tokens.css` direto — não há build de CSS no caminho — e calcula a razão
 * WCAG 2.x de cada par que o spec promete. Se alguém mexer num token e
 * derrubar um par abaixo de AA, isto falha em vez de virar um `[ ]` esquecido
 * num plano.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')

/**
 * O `:root { ... }` de topo (`media === null`) ou o único `:root` dentro do
 * `@media` pedido. O parser é deliberadamente burro: tokens.css é escrito na
 * forma que ele espera, e o comentário de cabeçalho de lá diz isso.
 */
function bloco(media: string | null): string {
  if (media === null) {
    const m = /^:root\s*\{([^}]*)\}/m.exec(css)
    if (!m) throw new Error(':root de topo não encontrado em tokens.css')
    return m[1]!
  }
  const inicio = css.indexOf(`@media ${media}`)
  if (inicio < 0) throw new Error(`@media ${media} não encontrado em tokens.css`)
  const abre = css.indexOf('{', css.indexOf(':root', inicio))
  const fecha = css.indexOf('}', abre)
  return css.slice(abre + 1, fecha)
}

function token(corpo: string, nome: string): string {
  const m = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(corpo)
  if (!m) throw new Error(`--${nome} não é um hex de 6 dígitos neste bloco`)
  return m[1]!.toLowerCase()
}

function canal(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
}

function luminancia(hex: string): number {
  const lin = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(canal(hex, 0)) + 0.7152 * lin(canal(hex, 1)) + 0.0722 * lin(canal(hex, 2))
}

/** Razão de contraste WCAG 2.x, sempre >= 1. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** `color-mix(in srgb, frente P%, fundo)` — mistura por canal, sem gama. */
function mistura(frente: string, fundo: string, p: number): string {
  const hex = [0, 1, 2]
    .map((i) => Math.round((canal(frente, i) * p + canal(fundo, i) * (1 - p)) * 255))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}

/** Opacidade do card em glass.css. Se mudar lá, muda aqui. */
const CARD_PAPEL = 0.84

const temas = [
  { nome: 'papel', media: null },
  { nome: 'noite', media: '(prefers-color-scheme: dark)' },
  { nome: 'papel, menos contraste', media: '(prefers-contrast: less)' },
  { nome: 'noite, menos contraste', media: '(prefers-contrast: less) and (prefers-color-scheme: dark)' },
]

describe.each(temas)('tema $nome', ({ media }) => {
  const base = bloco(null)
  const proprio = media === null ? base : bloco(media)
  // Um bloco de @media só redefine o que muda; o resto herda do topo.
  const ler = (nome: string): string => {
    try {
      return token(proprio, nome)
    } catch {
      return token(base, nome)
    }
  }
  const paper = ler('paper')
  const ink = ler('ink')

  it('texto sobre papel passa AA com folga', () => {
    expect(contraste(ink, paper)).toBeGreaterThanOrEqual(4.5)
  })

  it('texto sobre o card no pior caso passa AA', () => {
    // Pior caso: uma linha de tinta pura atrás do card, atravessando 16% do
    // vidro. Tinta pura no papel é `ink`, então o fundo do texto vira a
    // mistura de paper a 84% sobre ink.
    const fundoPior = mistura(paper, ink, CARD_PAPEL)
    expect(contraste(ink, fundoPior)).toBeGreaterThanOrEqual(4.5)
  })

  it('o anel de foco passa 3:1 contra o papel', () => {
    expect(contraste(ink, paper)).toBeGreaterThanOrEqual(3)
  })
})

describe('o âmbar do gato', () => {
  // O âmbar não é token de CSS — mora em src/world/palette.ts — mas o par
  // que faz o gato legível é decidido aqui, contra os tokens.
  const AMBAR = '#ffc27a'

  it('lê contra o papel da noite', () => {
    expect(contraste(AMBAR, token(bloco('(prefers-color-scheme: dark)'), 'paper'))).toBeGreaterThanOrEqual(3)
  })

  it('lê contra o corpo de tinta no papel', () => {
    // No papel o gato é corpo de tinta com forro âmbar: o forro é lido contra
    // o corpo, nunca contra o papel (onde daria 1.58:1).
    expect(contraste(AMBAR, token(bloco(null), 'ink'))).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run src/styles/__tests__/contraste.test.ts`
Expected: FAIL — `--paper não é um hex de 6 dígitos neste bloco` (o token
ainda não existe).

- [ ] **Step 4: Reescrever `tokens.css`**

Substitua o arquivo inteiro por:

```css
/*
 * Design tokens.
 *
 * Tinta sobre papel. A tese continua a mesma — o mundo atrás da página é o
 * drama, a página fica quieta — mas a paleta agora é a de uma folha impressa:
 * preto puro, branco puro, um cinza só para filetes. Nenhuma cor de destaque.
 * A única cor do site é o gato, e ela mora em `src/world/palette.ts`, não
 * aqui, porque nenhum elemento DOM a usa.
 *
 * Uma família só, um peso só: Cabin — a fonte livre inspirada na Gill Sans —
 * em 400 para tudo. A hierarquia vem do tamanho. Geist Mono fica para código.
 * Self-hosted, para que a página não faça request de terceiro antes de pintar.
 *
 * `__tests__/contraste.test.ts` lê este arquivo: mantenha um `:root { ... }`
 * de topo, um único `:root { ... }` dentro de cada `@media`, e o
 * `@media (prefers-contrast: less)` sozinho ANTES do combinado com
 * `prefers-color-scheme` — o teste acha cada bloco por `indexOf`.
 */

@import '@fontsource-variable/cabin/index.css';
@import '@fontsource-variable/geist-mono/index.css';

:root {
  --paper: #ffffff;
  --ink: #000000;
  /* Filetes de 1px. Nunca texto. */
  --rule: #bbbbbb;

  --font-sans: 'Cabin Variable', 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace;

  /*
   * 29 / 24 / 20 / 17, e um 15 para o que é subordinado (datas, notas, nav).
   * Escala curta: títulos discretos, quase do tamanho do texto. Em rem, para
   * zoom e tamanho de fonte do usuário funcionarem.
   */
  --text-h1: 1.8125rem;
  --text-h2: 1.5rem;
  --text-h3: 1.25rem;
  --text-body: 1.0625rem;
  --text-small: 0.9375rem;

  /* Apertado, mas com ar: o texto flutua sobre uma cena que se mexe. */
  --leading-body: 1.4;
  --leading-title: 1.15;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 72px;
  --space-9: 112px;

  --gutter: clamp(20px, 5vw, 40px);
  /* Estreito. Uma medida curta é a maior parte do que faz uma página parecer pensada. */
  --measure: 34rem;
  --radius: 14px;

  /* Escala semântica de z, pra nada nunca pedir 9999. */
  --z-canvas: 0;
  --z-content: 2;
  --z-veil: 3;
  --z-cue: 4;
}

/* A noite é o negativo exato: tinta branca sobre papel preto. */
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #000000;
    --ink: #ffffff;
    --rule: #444444;
  }
}

/* Quem pede menos contraste no SO recebe um pouco menos — ainda 16:1. */
@media (prefers-contrast: less) {
  :root {
    --paper: #fafafa;
    --ink: #1a1a1a;
  }
}

@media (prefers-contrast: less) and (prefers-color-scheme: dark) {
  :root {
    --paper: #0a0a0a;
    --ink: #e6e6e6;
  }
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/styles/__tests__/contraste.test.ts`
Expected: PASS — 4 temas × 3 asserções + 2 do âmbar = 14 testes.

- [ ] **Step 6: Suíte, typecheck e build**

Run: `npm test && npm run typecheck && npm run build`
Expected: tudo passa. O build resolve `@fontsource-variable/cabin/index.css`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/styles/tokens.css src/styles/__tests__/contraste.test.ts
git commit -m "feat: tokens de tinta sobre papel, Cabin no lugar do Geist, teste de contraste"
```

---

### Task 2: O DOM em tinta sobre papel

**Files:**
- Modify: `src/styles/base.css`, `src/styles/glass.css`, `src/styles/ui.css`, `src/styles/prose.css`
- Modify: `index.html`, `public/favicon.svg`
- Modify: `src/ui/Nav.ts:50` (comentário)

**Interfaces:**
- Consumes: os tokens da Task 1.
- Produces: nada que outra tarefa consuma. Depois disto, nenhum CSS cita
  `--green`, `--green-hot`, `--bg-deep`, `--ink-dim`, `--ink-faint`,
  `--text-xs/sm/base/md/lg/xl/2xl`, `--track-tight`, `--track-snug`.

Não há teste unitário para CSS; o gate é o grep do Step 7 e a verificação
no browser do Step 8.

- [ ] **Step 1: `base.css`**

Aplique estas substituições:

```css
/* body */
  background: var(--paper);

/* #veil */
  background: var(--paper);

/* ::selection — o inverso exato, como tinta selecionada num papel */
::selection {
  background: var(--ink);
  color: var(--paper);
}

/* :focus-visible */
:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
  border-radius: 4px;
}

/* .noscript — e corrige o `var(--step)` indefinido que deixava o h1 sem margem */
.noscript h1 {
  font-size: var(--text-h1);
  font-weight: 400;
  line-height: var(--leading-title);
  letter-spacing: 1px;
  margin: 0 0 var(--space-4);
}
.noscript p {
  color: var(--ink);
  font-size: var(--text-body);
  line-height: var(--leading-body);
}
.noscript a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

- [ ] **Step 2: `glass.css`**

Troque o fundo do card e do painel opaco, e remova o realce do topo:

```css
.material {
  position: relative;
  isolation: isolate;
  border-radius: var(--radius);
  /*
   * 84%, medido e não estimado — ver `contraste.test.ts`, que calcula o
   * pior caso: uma linha de tinta pura atravessando 16% do vidro. A 84%
   * todo texto passa de 4.5:1 nos dois temas.
   */
  background: color-mix(in srgb, var(--paper) 84%, transparent);
  border: 1px solid var(--rule);
}
```

```css
.lg-no-backdrop .material {
  background: color-mix(in srgb, var(--paper) 94%, transparent);
}
```

Apague o bloco `.material::before { ... }` inteiro e o comentário acima dele
("Um único realce no topo..."). Substitua por:

```css
/* Sem realce, sem sombra. Uma folha sobre outra folha é só um filete. */
```

- [ ] **Step 3: `ui.css`**

Cabeçalho do arquivo (linhas 1–7) vira:

```css
/*
 * Layout.
 *
 * Coluna única e estreita. A hierarquia vem de tamanho e espaço — não de cor,
 * não de peso, não de moldura. Nenhuma cor: tinta sobre papel. A única cor do
 * site é o gato, e ele não mora aqui.
 */
```

Depois, regra a regra (só as declarações citadas mudam; o resto de cada
bloco fica):

```css
.hero h1 {
  font-size: var(--text-h1);
  font-weight: 400;
  line-height: var(--leading-title);
  letter-spacing: 1px;
  margin: 0;
  color: var(--ink);
}

.hero .lead {
  font-size: var(--text-body);
  font-weight: 400;
  line-height: var(--leading-body);
  color: var(--ink);
  margin: var(--space-4) 0 0;
  max-width: 30rem;
  text-wrap: pretty;
}

.hero .meta {
  /* ...display/gap/margin iguais... */
  font-size: var(--text-small);
  color: var(--ink);
}

/* O filete acima do h2 já existe: é o `.bloco + .bloco::before` animado,
   com o espaço próprio do bloco. O `padding-top: 9px` da referência não se
   aplica aqui — seria trocar o layout, que fica como está. */
.bloco h2 {
  font-size: var(--text-h2);
  font-weight: 400;
  line-height: var(--leading-title);
  letter-spacing: 0;
  color: var(--ink);
  margin: 0 0 var(--space-4);
}

.prosa p {
  font-size: var(--text-body);
  line-height: var(--leading-body);
  color: var(--ink);
  margin: 0 0 var(--space-4);
  text-wrap: pretty;
}

.agenda dt {
  /* ...display/align/gap iguais... */
  font-size: var(--text-small);
  color: var(--ink);
}

.agenda dd {
  margin: 0;
  font-size: var(--text-body);
  color: var(--ink);
}

.porque {
  display: block;
  font-size: var(--text-small);
  color: var(--ink);
  margin-top: 2px;
}

.ponto {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--ink);
  flex: none;
}

.ponto.is-agora {
  background: var(--ink);
  border-color: var(--ink);
}

.grupo-rotulo {
  font-size: var(--text-small);
  font-weight: 400;
  color: var(--ink);
  margin: 0 0 var(--space-2);
}

.paixao {
  /* ...display/align/justify/gap/padding/cursor/transition iguais... */
  font-size: var(--text-body);
}

.paixao-nota {
  font-size: var(--text-small);
  color: var(--ink);
  text-align: right;
}

.links a {
  /* ...display/align/justify/gap/padding/text-decoration/color iguais... */
  font-size: var(--text-body);
}

/* O link é a linha inteira; o sublinhado fica só no rótulo, como texto. */
.link-rotulo {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  transition: text-decoration-thickness 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.link-nota {
  font-size: var(--text-small);
  color: var(--ink);
  text-align: right;
}

.links a:hover .link-rotulo,
.links a:focus-visible .link-rotulo {
  text-decoration-thickness: 2px;
}

.convite p {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--leading-body);
  color: var(--ink);
}

.convite a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}

.convite a:hover,
.convite a:focus-visible {
  text-decoration-thickness: 2px;
}

.galhos a {
  /* ...iguais... */
  font-size: var(--text-body);
}

.galho-titulo {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  transition: text-decoration-thickness 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.galho-meta {
  font-size: var(--text-small);
  color: var(--ink);
  text-align: right;
  white-space: nowrap;
}

.galhos a:hover .galho-titulo,
.galhos a:focus-visible .galho-titulo {
  text-decoration-thickness: 2px;
}

.page-foot {
  /* ...iguais... */
  font-size: var(--text-small);
  color: var(--ink);
}

.cue {
  /* ...iguais... */
  font-size: var(--text-small);
  color: var(--ink);
}

.pilula {
  /* ...iguais... */
  background: color-mix(in srgb, var(--paper) 72%, transparent);
}

.pilula a {
  position: relative;
  z-index: 1;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: var(--text-small);
  color: var(--ink);
  text-decoration: none;
}

.thumb {
  /* ...iguais... */
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 24%, transparent);
}
```

Apague inteiros: `.pilula a[aria-current='page'] { ... }` e
`.pilula a:hover { ... }` (todo texto da nav já é tinta; o thumb diz qual é
a rota ativa). Apague `letter-spacing: var(--track-snug)` e
`letter-spacing: var(--track-tight)` de onde ainda restarem.

- [ ] **Step 4: `prose.css`**

```css
.voltar {
  display: inline-block;
  font-size: var(--text-small);
  color: var(--ink);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  margin-bottom: var(--space-5);
}

.voltar:hover,
.voltar:focus-visible {
  text-decoration-thickness: 2px;
}

.carimbo {
  font-family: var(--font-mono);
  font-size: var(--text-small);
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  margin: 0 0 var(--space-3);
}

.leitura h1 {
  font-size: var(--text-h1);
  font-weight: 400;
  line-height: var(--leading-title);
  letter-spacing: 1px;
  text-wrap: balance;
  margin: 0 0 var(--space-6);
  color: var(--ink);
}

.prosa-post {
  font-size: var(--text-body);
  line-height: var(--leading-body);
  color: var(--ink);
}

.prosa-post h2,
.prosa-post h3 {
  color: var(--ink);
  font-weight: 400;
  line-height: var(--leading-title);
  margin-top: var(--space-7);
}

.prosa-post h2 { font-size: var(--text-h2); }
.prosa-post h3 { font-size: var(--text-h3); margin-bottom: 6px; }

.prosa-post a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}

.prosa-post a:hover,
.prosa-post a:focus-visible {
  text-decoration-thickness: 2px;
}

.prosa-post code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}

.prosa-post pre {
  font-family: var(--font-mono);
  font-size: var(--text-small);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--space-4);
  overflow-x: auto;
}

.prosa-post blockquote {
  margin: 0;
  padding-left: var(--space-4);
  border-left: 2px solid var(--rule);
  color: var(--ink);
}

.leitura-progresso {
  /* ...iguais... */
  background: var(--ink);
}
```

- [ ] **Step 5: `index.html` e `favicon.svg`**

Em `index.html`, troque as três linhas de meta:

```html
    <meta name="color-scheme" content="light dark" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="mask-icon" href="/favicon.svg" color="#000000" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
```

`public/favicon.svg` inteiro:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <!-- Um galho em tinta, grosso o bastante pra sobreviver a 16px. Placa
       transparente; a cor segue o esquema do SO. Safari ignora SVG aqui e usa
       o mask-icon, que é monocromático de qualquer jeito. -->
  <style>
    .t { stroke: #000000; }
    .n { fill: #000000; }
    @media (prefers-color-scheme: dark) {
      .t { stroke: #ffffff; }
      .n { fill: #ffffff; }
    }
  </style>
  <g class="t" fill="none" stroke-width="2" stroke-linecap="round">
    <path d="M16 28V13"/>
    <path d="M16 17 8.5 9.5"/>
    <path d="M16 14 23.5 6.5"/>
    <path d="M16 21l-4.5-4.5"/>
  </g>
  <g class="n">
    <circle cx="8.5" cy="9.5" r="1.7"/>
    <circle cx="23.5" cy="6.5" r="1.7"/>
    <circle cx="11.5" cy="16.5" r="1.3"/>
  </g>
</svg>
```

- [ ] **Step 6: `Nav.ts:50`**

Troque `// \`--font-sans\` troca de system-ui pra Geist com \`font-display: swap\`.`
por `// \`--font-sans\` troca da fonte de reserva pra Cabin com \`font-display: swap\`.`

- [ ] **Step 7: Grep de tokens mortos**

Run:
```bash
grep -rn -e '--green' -e '--bg-deep' -e '--bg-card' -e '--bg-lifted' -e '--ink-dim' -e '--ink-faint' -e '--track-' -e '--text-xs' -e '--text-sm' -e '--text-base' -e '--text-md' -e '--text-lg' -e '--text-xl' -e '--text-2xl' -e '--amber' -e '--step' src/styles index.html
```
Expected: nenhuma linha.

Run: `npm test && npm run typecheck && npm run build`
Expected: passa.

- [ ] **Step 8: Verificação no browser**

`npm run dev`, abra `/` no Chrome. Confira (a cena ainda é verde sobre preto
— o mundo só muda na Task 3–5; aqui é o DOM):

- Cards brancos foscos com filete `#bbb`, texto preto, sem realce no topo.
- Todo texto no mesmo peso; h1 do hero a 29px com tracking de 1px.
- Links sublinhados em preto; hover engrossa o sublinhado, sem cor.
- Foco (Tab) mostra anel preto de 2px.
- Seleção de texto é preto com texto branco.
- Nav: pílula branca translúcida, thumb cinza.
- Aba do browser: favicon em tinta preta.
- `/blog` e um post: mesma regra, blockquote com régua `#bbb`, código em
  fundo branco.
- DevTools → Rendering → Emulate `prefers-color-scheme: dark`: tudo inverte
  (texto branco, cards pretos). Emulate `prefers-contrast: less`: `#1a1a1a`
  sobre `#fafafa`.

- [ ] **Step 9: Commit**

```bash
git add src/styles/base.css src/styles/glass.css src/styles/ui.css src/styles/prose.css index.html public/favicon.svg src/ui/Nav.ts
git commit -m "feat: o DOM em tinta sobre papel — Cabin 400, escala 29/24/20/17, sem cor fora do gato"
```

---

### Task 3: `palette.ts` e a cena em cinza

**Files:**
- Create: `src/world/palette.ts`
- Create: `src/world/__tests__/palette.test.ts`
- Modify: `src/core/Stage.ts:20`, `src/world/ScanReveal.ts:40-41`,
  `src/world/ScanPulse.ts:26`, `src/world/Ground.ts:32`,
  `src/world/Motes.ts:40`, `src/world/PointerTrail.ts:57,90`,
  `src/world/TrunkRings.ts:48-49`, `src/world/Fireflies.ts:35,82`,
  `src/world/BranchLabels.ts:119-120,131,184`, `src/world/Cat.ts:44-45`

**Interfaces:**
- Produces: `src/world/palette.ts` exporta
  `PAPER = 0x000000`, `INK = 0xffffff`, `INK_REST = 0xb4b4b4`,
  `INK_FAINT = 0x8c8c8c`, `AMBER = 0xffc27a`, `AMBER_INVERTIDO = 0x003d85`
  (todos `number`). Tasks 6 e 7 importam daqui.
- `ScanReveal.ts` deixa de exportar `SCAN_REST_COLOR`/`SCAN_EDGE_COLOR`;
  `Cat.ts` deixa de exportar `CAT_COLOR`/`CAT_RIM`.

Estado ao fim: a cena é tinta clara sobre preto (o "negativo" da noite),
ainda sem inversão. Verifique no browser que ela continua lendo como um scan.

- [ ] **Step 1: Escrever o teste da paleta (vai falhar)**

Crie `src/world/__tests__/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AMBER, AMBER_INVERTIDO, INK, INK_FAINT, INK_REST, PAPER } from '../palette'

function cinza(hex: number): boolean {
  const r = (hex >> 16) & 255
  const g = (hex >> 8) & 255
  const b = hex & 255
  return r === g && g === b
}

describe('palette', () => {
  it('todo tom do mundo é cinza', () => {
    for (const tom of [PAPER, INK, INK_REST, INK_FAINT]) expect(cinza(tom)).toBe(true)
  })

  it('o papel é preto puro e a tinta branca pura — senão a inversão dá um branco sujo', () => {
    expect(PAPER).toBe(0x000000)
    expect(INK).toBe(0xffffff)
  })

  it('o âmbar é a única cor, e é exatamente a do gato', () => {
    expect(AMBER).toBe(0xffc27a)
    expect(cinza(AMBER)).toBe(false)
  })

  it('o âmbar invertido é o complemento exato, pra sair certo depois do passe final', () => {
    expect(AMBER_INVERTIDO).toBe(0xffffff - AMBER)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/world/__tests__/palette.test.ts`
Expected: FAIL — `Cannot find module '../palette'`.

- [ ] **Step 3: Criar `palette.ts`**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/world/__tests__/palette.test.ts`
Expected: PASS (4).

- [ ] **Step 5: Apontar cada constante da cena para a paleta**

`src/core/Stage.ts`:
```ts
import { PAPER } from '../world/palette'
// ...
export const BG_COLOR = PAPER
```
(O nome `BG_COLOR` fica: `Stage.ts:62` e `:68` o usam.)

`src/world/ScanReveal.ts` — apague as linhas 40–41 e importe:
```ts
import { INK, INK_REST } from './palette'
```
e troque os quatro usos: `new Color(SCAN_REST_COLOR)` → `new Color(INK_REST)`,
`new Color(SCAN_EDGE_COLOR)` → `new Color(INK)` (linhas 73–74 e 120–121).

`src/world/Fireflies.ts`:
```ts
import { INK } from './palette'
// ...
  constructor(quality: Quality, color = INK) {
```
(apague o `import { SCAN_EDGE_COLOR } from './ScanReveal'`).

`src/world/ScanPulse.ts:26`: `constructor(origin: Vector3, color = INK_REST) {` + import.

`src/world/Ground.ts:32`: `constructor(origin: Vector3, y = -2.6, color = INK_FAINT) {` + import.

`src/world/Motes.ts:40`: `color = INK_REST,` + import.

`src/world/PointerTrail.ts`:
```ts
  constructor(quality: Quality, color = INK_REST) {
// ...
        uHot: { value: new Color(INK) },
```

`src/world/TrunkRings.ts:48-49`:
```ts
  private restColor = new Color(INK_REST)
  private litColor = new Color(INK)
```

`src/world/BranchLabels.ts`:
```ts
import { INK, INK_FAINT } from './palette'
// ...
const COR_REPOUSO = INK_FAINT
const COR_ACESA = INK
// ...
/** Mesmo peso do resto da página: 400 em tudo, a hierarquia é o tamanho. */
const FONTE_PESO = 400
// ...
  ctx.fillStyle = new Color(INK).getStyle()
```
(`Color` já é importado de `three` neste arquivo — `BranchLabels.ts:207`
usa `new Color(COR_REPOUSO)`; com `COR_REPOUSO` agora número, essas duas
linhas continuam válidas.)

`src/world/Cat.ts:44-45` — apague os dois `export const` e importe:
```ts
import { AMBER, PAPER } from './palette'
```
trocando `new Color(CAT_COLOR)` → `new Color(PAPER)` (linha 67) e os dois
`new Color(CAT_RIM)` → `new Color(AMBER)` (linhas 68 e 79). O corpo do gato
era `#07160f`, um preto esverdeado; agora é o preto do papel — na noite
nada muda a olho, e no papel é o que a Task 6 pré-inverte.

- [ ] **Step 6: Suíte e typecheck**

Run: `npm test && npm run typecheck`
Expected: passa. Se `tsc` reclamar de import não usado (`Color` em algum
arquivo), remova o import.

- [ ] **Step 7: Verificação no browser**

`npm run dev`, `/`. A cena deve ser cinza-claro sobre preto: árvore branca
com crista do scan mais branca ainda, chão e motes cinza, gato preto com
forro âmbar. O scan ainda lê como scan. Console sem erro WebGL.

- [ ] **Step 8: Commit**

```bash
git add src/world/palette.ts src/world/__tests__/palette.test.ts src/core/Stage.ts src/world/ScanReveal.ts src/world/ScanPulse.ts src/world/Ground.ts src/world/Motes.ts src/world/PointerTrail.ts src/world/TrunkRings.ts src/world/Fireflies.ts src/world/BranchLabels.ts src/world/Cat.ts
git commit -m "feat: paleta do mundo em cinza num módulo só; o âmbar do gato é a única cor"
```

---

### Task 4: `Quality.tema`

**Files:**
- Modify: `src/core/Quality.ts`
- Modify: `src/core/__tests__/Quality.test.ts`

**Interfaces:**
- Produces:
  - `export type Tema = 'papel' | 'noite'`
  - `new Quality(hints?, reducedMotion?, tema?: Tema)` — terceiro parâmetro
    injetável, default lido de `matchMedia('(prefers-color-scheme: dark)')`,
    `'papel'` fora do browser.
  - `quality.tema: Tema` (getter)
  - `quality.setTema(tema: Tema): void` — no-op se igual; senão dispara os
    listeners com o novo valor.
  - `quality.onTema(fn: (tema: Tema) => void): void`
  Tasks 5 e 6 consomem estes três.

- [ ] **Step 1: Escrever os testes (vão falhar)**

Adicione ao fim de `src/core/__tests__/Quality.test.ts`, dentro de um
novo `describe`:

```ts
describe('Quality.tema', () => {
  it('fora do browser é papel', () => {
    // O terceiro parâmetro não é passado: o default lê matchMedia, que não
    // existe no ambiente node do vitest.
    expect(new Quality(desktop, false).tema).toBe('papel')
  })

  it('aceita o tema injetado', () => {
    expect(new Quality(desktop, false, 'noite').tema).toBe('noite')
  })

  it('avisa quem escuta quando o tema muda, com o valor novo', () => {
    const q = new Quality(desktop, false, 'papel')
    const spy = vi.fn()
    q.onTema(spy)
    q.setTema('noite')
    expect(q.tema).toBe('noite')
    expect(spy).toHaveBeenCalledWith('noite')
  })

  it('não avisa quando o tema é o mesmo', () => {
    const q = new Quality(desktop, false, 'papel')
    const spy = vi.fn()
    q.onTema(spy)
    q.setTema('papel')
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/core/__tests__/Quality.test.ts`
Expected: FAIL — `tema` é `undefined`; `onTema is not a function`.

- [ ] **Step 3: Implementar**

Em `src/core/Quality.ts`, logo abaixo de `readReducedMotion`:

```ts
export type Tema = 'papel' | 'noite'

function readTema(): Tema {
  if (typeof window === 'undefined' || !window.matchMedia) return 'papel'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'noite' : 'papel'
}
```

Na classe:

```ts
  private temaAtual: Tema
  private temaListeners: ((tema: Tema) => void)[] = []

  constructor(
    hints: DeviceHints = readHints(),
    reducedMotion: boolean = readReducedMotion(),
    tema: Tema = readTema(),
  ) {
    this.initialTier = tierFromHints(hints)
    this.runningTier = this.initialTier
    this.reducedMotion = reducedMotion
    this.temaAtual = tema
  }

  /** Papel por padrão; noite quando o SO pede. O SO é o único toggle. */
  get tema(): Tema {
    return this.temaAtual
  }

  /** Chamado pelo listener da media query em `main.ts`. Injetável pra teste. */
  setTema(tema: Tema): void {
    if (tema === this.temaAtual) return
    this.temaAtual = tema
    for (const fn of this.temaListeners) fn(tema)
  }

  onTema(fn: (tema: Tema) => void): void {
    this.temaListeners.push(fn)
  }
```

Atualize o comentário de cabeçalho do arquivo: acrescente um parágrafo
"Também carrega o tema (`papel` | `noite`), porque é o mesmo tipo de fato —
uma preferência do SO lida uma vez e observada depois — e todo subsistema
já recebe `Quality` na construção."

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/core/__tests__/Quality.test.ts`
Expected: PASS (todos, inclusive os 4 novos).

- [ ] **Step 5: Commit**

```bash
git add src/core/Quality.ts src/core/__tests__/Quality.test.ts
git commit -m "feat: Quality.tema lê prefers-color-scheme e avisa quem escuta"
```

---

### Task 5: A inversão

**Files:**
- Modify: `src/fx/shaders/finish.ts`
- Modify: `src/fx/Post.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Quality.tema`, `onTema`, `setTema`, `Tema` (Task 4).
- Produces: `Post.setTema(tema: Tema): void` (público; a Task 6 o estende).

Sem teste unitário — é WebGL. O gate é o browser.

- [ ] **Step 1: `finish.ts`**

Cabeçalho vira:

```ts
/**
 * Final grade: inversão de tema, aberração cromática radial, vinheta e grão.
 *
 * Roda depois do tone mapping e da codificação sRGB, então tudo aqui opera
 * em espaço de exibição. A inversão vem antes da vinheta e do grão de
 * propósito: os dois precisam agir sobre a imagem final — no papel, a vinheta
 * escureceria bordas (por isso é zero lá) e o grão vira textura de papel.
 * A aberração fica antes da inversão: as franjas trocam pelas complementares
 * e ninguém nota; um caminho separado não paga o próprio custo.
 */
```

Uniform novo, depois de `uAberration`:

```ts
    /** 1 no papel: o frame inteiro vira o negativo. 0 na noite. */
    uInvert: { value: 0 },
```

No fragment shader, declare `uniform float uInvert;` junto dos outros e,
logo depois de `vec3 color = vec3(red, base.g, blue);`, antes da vinheta:

```glsl
      // Tinta sobre papel: o mundo é renderizado como luz e invertido aqui.
      color = mix(color, 1.0 - color, uInvert);
```

- [ ] **Step 2: `Post.ts`**

Imports: acrescente `import type { Tema } from '../core/Quality'`.

Constantes, abaixo de `BLOOM_THRESHOLD`:

```ts
/** Zero no papel: a referência não tem sombra nenhuma. */
const VIGNETTE_NOITE = 0.85
const VIGNETTE_PAPEL = 0
```

No fim do construtor, depois de `quality.onDowngrade(...)`:

```ts
    this.setTema(quality.tema)
    quality.onTema((tema) => this.setTema(tema))
```

Método novo:

```ts
  /** Papel inverte o frame e apaga a vinheta; noite é a cena como renderizada. */
  setTema(tema: Tema): void {
    const papel = tema === 'papel'
    this.finish.uniforms['uInvert']!.value = papel ? 1 : 0
    this.finish.uniforms['uVignette']!.value = papel ? VIGNETTE_PAPEL : VIGNETTE_NOITE
  }
```

- [ ] **Step 3: `main.ts` — o listener da media query**

Logo depois de `const quality = new Quality()`:

```ts
// O SO é o toggle de tema. Trocar a aparência com o site aberto troca o tema
// ao vivo; o CSS já reage sozinho via @media, isto é só pro mundo.
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => quality.setTema(e.matches ? 'noite' : 'papel'))
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck && npm test`
Expected: passa.

- [ ] **Step 5: Verificação no browser**

`npm run dev`, `/`, com o macOS em aparência clara:

- Papel branco. A intro desenha a árvore em tinta preta; a crista do scan é
  preto puro com sangria escura ao redor (o bloom invertido). Linhas em
  repouso cinza-lápis.
- Sem vinheta; grão fino no papel.
- O gato aparece **branco com forro azul-escuro** — esperado nesta tarefa;
  a Task 6 corrige. Não ajuste aqui.
- Troque a aparência do macOS para escuro com a aba aberta: a cena volta a
  ser tinta clara sobre preto, com vinheta, sem recarregar.
- Console limpo.

Se a sangria no papel estiver pesada demais para ler o texto dos cards
sobre a árvore, abaixe `INK_REST` (`palette.ts`) um passo (ex. `0x9e9e9e`)
antes de mexer em `BLOOM_STRENGTH`; o bloom é a assinatura do scan.

- [ ] **Step 6: Commit**

```bash
git add src/fx/shaders/finish.ts src/fx/Post.ts src/main.ts
git commit -m "feat: papel inverte o frame no passe final; noite é a cena como renderizada"
```

---

### Task 6: O gato no papel

**Files:**
- Modify: `src/world/Cat.ts`
- Modify: `src/fx/Post.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `AMBER`, `AMBER_INVERTIDO`, `INK`, `PAPER` (Task 3); `Tema`,
  `quality.tema`, `onTema` (Task 4); `Post.setTema` (Task 5).
- Produces: `export const CAT_LAYER = 1` em `Cat.ts`;
  `Cat.setTema(tema: Tema): void`.

- [ ] **Step 1: `Cat.ts` — layer e `setTema`**

Imports:
```ts
import type { Tema } from '../core/Quality'
import { AMBER, AMBER_INVERTIDO, INK, PAPER } from './palette'
```

Constante exportada, abaixo de `TAIL_SEGMENT_LENGTH`:

```ts
/**
 * Layer própria. No papel, `Post` tira o gato da passada principal e o
 * desenha depois do bloom: um corpo claro pré-inversão é a maior área
 * brilhante da cena, e o bloom o transformaria numa mancha escura no papel.
 * O `proxy` de hover fica na layer 0 — o raycaster só olha lá.
 */
export const CAT_LAYER = 1
```

Em `part()`, depois de criar `mesh` e `edges`:

```ts
    mesh.layers.set(CAT_LAYER)
    edges.layers.set(CAT_LAYER)
```

Método novo, antes de `setPose`:

```ts
  /**
   * No papel o frame é invertido, então o gato recebe o negativo do que deve
   * aparecer: corpo `INK` (sai preto), forro `AMBER_INVERTIDO` (sai #ffc27a),
   * arestas `INK` (saem tinta). Na noite, o que sempre foi.
   */
  setTema(tema: Tema): void {
    const papel = tema === 'papel'
    ;(this.material.uniforms['uColor']!.value as Color).setHex(papel ? INK : PAPER)
    ;(this.material.uniforms['uRim']!.value as Color).setHex(papel ? AMBER_INVERTIDO : AMBER)
    this.edgeMaterial.color.setHex(papel ? INK : AMBER)
  }
```

- [ ] **Step 2: `Post.ts` — `CatPass`**

Imports: acrescente `Pass` e os tipos:

```ts
import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { Pass } from 'three/addons/postprocessing/Pass.js'
import { CAT_LAYER } from '../world/Cat'
```

Classe, acima de `export class Post`:

```ts
/**
 * Desenha só a layer do gato por cima do buffer já com bloom, sem limpar a
 * cor. Limpa o depth antes: o quad de tela cheia do bloom pode ter escrito
 * profundidade, e o gato seria recusado inteiro. O custo aceito: galhos na
 * frente do gato não o ocluem no papel — raro na pose atual.
 */
class CatPass extends Pass {
  constructor(
    private scene: Scene,
    private camera: Camera,
  ) {
    super()
    this.needsSwap = false
  }

  override render(renderer: WebGLRenderer, _write: WebGLRenderTarget, read: WebGLRenderTarget): void {
    const mask = this.camera.layers.mask
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(this.renderToScreen ? null : read)
    renderer.clearDepth()
    this.camera.layers.set(CAT_LAYER)
    renderer.render(this.scene, this.camera)
    this.camera.layers.mask = mask
    renderer.autoClear = autoClear
  }
}
```

Na classe `Post`: campos `private catPass: CatPass` e
`private camera: Camera`. No construtor, `this.camera = stage.camera`, e
entre o bloom e o `OutputPass`:

```ts
    this.composer.addPass(this.bloom)

    this.catPass = new CatPass(stage.scene, stage.camera)
    this.composer.addPass(this.catPass)

    this.composer.addPass(new OutputPass())
```

`setTema` vira:

```ts
  setTema(tema: Tema): void {
    const papel = tema === 'papel'
    this.finish.uniforms['uInvert']!.value = papel ? 1 : 0
    this.finish.uniforms['uVignette']!.value = papel ? VIGNETTE_PAPEL : VIGNETTE_NOITE

    // Câmeras nascem vendo só a layer 0. Na noite o gato entra na passada
    // principal (e ganha o halo âmbar do bloom); no papel sai dela e é
    // desenhado depois pelo CatPass.
    this.catPass.enabled = papel
    if (papel) this.camera.layers.disable(CAT_LAYER)
    else this.camera.layers.enable(CAT_LAYER)
  }
```

- [ ] **Step 3: `main.ts` — ligar o gato ao tema**

Depois de `const cat = new Cat()`:

```ts
cat.setTema(quality.tema)
quality.onTema((tema) => cat.setTema(tema))
```

- [ ] **Step 4: Typecheck e suíte**

Run: `npm run typecheck && npm test`
Expected: passa. Se `tsc` reclamar de `override` (`noImplicitOverride`
desligado) ou do tipo de `layers.mask`, ajuste o modificador, não a lógica.

- [ ] **Step 5: Verificação no browser**

Aparência clara, `/`, espere o gato pousar:

- Corpo escuro (cinza-escuro, não preto puro: o fog dissolve ~28% do corpo
  para o papel à distância da árvore — o mesmo que já acontece na noite, só
  que lá é invisível). Forro âmbar `#ffc27a` na silhueta, arestas em tinta.
- **Nenhuma mancha escura** ao redor do gato. Se houver, o `CatPass` não
  está ativo ou a layer não foi aplicada em todas as partes — `console.log`
  de `__world.stage.camera.layers.mask` deve ser `1` no papel.
- Passe o mouse: o gato assusta e foge como antes (o proxy continua na
  layer 0).
- Aparência escura: gato preto com forro âmbar e halo de bloom, como antes
  desta iniciativa. `__world.stage.camera.layers.mask` deve ser `3`.
- Trocar a aparência com o site aberto alterna os dois sem recarregar.

Se o corpo cinza-escuro incomodar e quiser preto: `fog: false` no
`ShaderMaterial` do gato só no papel é o botão — **não** faça isso nesta
tarefa; anote e decida com o autor.

- [ ] **Step 6: Commit**

```bash
git add src/world/Cat.ts src/fx/Post.ts src/main.ts
git commit -m "feat: o gato no papel — corpo de tinta, forro #ffc27a exato, fora do bloom"
```

---

### Task 7: Mundos dos posts — matiz vira pressão

**Files:**
- Modify: `src/world/PostWorld.ts`
- Modify: `src/world/__tests__/PostWorld.test.ts`
- Modify: `content/worlds/como-cheguei-aqui.ts:44-66, 509-510, 720, 744-745, 761-764`
- Modify: `src/world/__tests__/palette.test.ts` (teste de cor solta)

**Interfaces:**
- Consumes: `INK`, `INK_REST` (Task 3).
- Produces (em `PostWorld.ts`):
  - `export function pressaoDaTag(tag: string | undefined): number` — `1`
    sem tag; senão determinístico em `[0.8, 1.3]`.
  - `export function pressaoEnvelope(progress: number, pressao: number): number`
    — `1` em `progress = 0` e em `progress >= 0.97`; `pressao` em `0.5`.
  - `hueDaTag` e `hueEnvelope` **deixam de existir**.

- [ ] **Step 1: Reescrever os testes de tom como testes de pressão (vão falhar)**

Em `src/world/__tests__/PostWorld.test.ts`, no import, troque
`hueDaTag, hueEnvelope,` por `pressaoDaTag, pressaoEnvelope,`. Substitua
os dois `describe` (`hueDaTag` e `hueEnvelope`) por:

```ts
describe('pressaoDaTag', () => {
  it('sem tag é a pressão base, exatamente', () => {
    expect(pressaoDaTag(undefined)).toBe(1)
  })

  it('a mesma tag dá sempre a mesma pressão', () => {
    expect(pressaoDaTag('carreira')).toBe(pressaoDaTag('carreira'))
  })

  it('tags diferentes tendem a dar pressões diferentes', () => {
    const maos = new Set(['meta', 'carreira', 'código', 'roça', 'cinema'].map(pressaoDaTag))
    expect(maos.size).toBeGreaterThanOrEqual(4)
  })

  it('nunca sai da faixa de mão leve a mão pesada — o contrato do mundo exige', () => {
    for (const tag of ['a', 'bb', 'ccc', 'zzzzzz', 'ção', '']) {
      expect(pressaoDaTag(tag)).toBeGreaterThanOrEqual(0.8)
      expect(pressaoDaTag(tag)).toBeLessThanOrEqual(1.3)
    }
  })
})

describe('pressaoEnvelope', () => {
  it('começa na base', () => {
    expect(pressaoEnvelope(0, 1.2)).toBe(1)
  })

  it('chega na pressão da tag no meio da leitura', () => {
    expect(pressaoEnvelope(0.5, 1.2)).toBeCloseTo(1.2, 10)
  })

  it('volta pra base a partir de 0.97', () => {
    expect(pressaoEnvelope(0.97, 1.2)).toBe(1)
    expect(pressaoEnvelope(1, 1.2)).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/world/__tests__/PostWorld.test.ts`
Expected: FAIL — `pressaoDaTag` não é exportado.

- [ ] **Step 3: `PostWorld.ts`**

Import: `import { INK, INK_REST } from './palette'`.

Troque as constantes `VERDE`/`DERIVA` (linhas 35–37) por:

```ts
/** Pressão base da pena. Todo mundo sai daqui e volta pra cá. */
const PRESSAO_BASE = 1
/** Faixa permitida pelo contrato do mundo: de mão leve a mão pesada. */
const PRESSAO_MIN = 0.8
const PRESSAO_MAX = 1.3
/** Quantos degraus a faixa tem — só pra tags distintas caírem em valores distintos. */
const PRESSAO_DEGRAUS = 50
```

Troque `hueDaTag` (com seu comentário) por:

```ts
/**
 * Pressão da pena derivada da primeira tag do post.
 *
 * O mundo é monocromático — tinta, como a árvore — então uma tag não escolhe
 * cor: escolhe quanto a mão aperta. A faixa é limitada de propósito: o
 * contrato diz que o leitor entra na pressão base e sai nela, e nenhuma tag
 * pode apagar um galhinho nem transformá-lo em borrão. Cada assunto ganha um
 * traço próprio, não uma paleta própria.
 */
export function pressaoDaTag(tag: string | undefined): number {
  if (!tag) return PRESSAO_BASE
  const degrau = Math.abs(fnv1a(tag)) % (PRESSAO_DEGRAUS + 1)
  return PRESSAO_MIN + ((PRESSAO_MAX - PRESSAO_MIN) * degrau) / PRESSAO_DEGRAUS
}
```

Atualize o comentário de `fnv1a` (linha ~76): "`pressaoDaTag` e a semente
do rng…".

Troque `HUE_ENTRA_ATE`/`HUE_SAI_DE`/`HUE_VERDE_DESDE` e `hueEnvelope` por:

```ts
/** Progresso em que a deriva de pressão termina de entrar. */
const PRESSAO_ENTRA_ATE = 0.15
/** Progresso em que a deriva começa a voltar pra base. */
const PRESSAO_SAI_DE = 0.8
/** Contrato do mundo: de volta à base a partir daqui — cláusula 3. */
const PRESSAO_BASE_DESDE = 0.97

/**
 * Envelope de pressão ao longo da leitura: base no início, deriva pra
 * pressão da tag no meio, base de novo a partir de `PRESSAO_BASE_DESDE`.
 *
 * O contrato do mundo diz que o leitor entra na tinta da árvore e sai nela —
 * a árvore é a única coisa no site que nunca muda, e é dela que o leitor
 * decola e é a ela que volta. Uma tag escolhe quanto a mão aperta, não se
 * aperta: por isso isto é uma função de `progress`, não de `pressaoDaTag`
 * sozinho.
 */
export function pressaoEnvelope(progress: number, pressao: number): number {
  const entra = beat(progress, 0, PRESSAO_ENTRA_ATE)
  const sai = 1 - beat(progress, PRESSAO_SAI_DE, PRESSAO_BASE_DESDE)
  return lerp(PRESSAO_BASE, pressao, Math.min(entra, sai))
}
```

`HUE_LAMBDA` (linha ~183) vira:

```ts
/** Velocidade com que a pressão persegue o envelope — mais lenta que o
 *  crescimento, pra que a deriva nunca leia como um flash. */
const PRESSAO_LAMBDA = 4
```

Na classe `GeneratedPostWorld`:

```ts
  private pressaoAlvo = PRESSAO_BASE
  private pressaoAtual = PRESSAO_BASE
```

Em `build`:

```ts
    this.pressaoAlvo = pressaoDaTag(ctx.post.tags[0])
    this.pressaoAtual = PRESSAO_BASE
```

Apague `const color = new Color().setHSL(this.hueAtual / 360, 0.72, 0.6)` e,
nos uniforms:

```ts
          uRestColor: { value: new Color(INK_REST) },
          uEdgeColor: { value: new Color(INK) },
          uOpacity: { value: 1 },
          uGain: { value: TWIG_GAIN * PRESSAO_BASE },
```

Em `update`, substitua o bloco do `hueTarget`/`setHSL` por:

```ts
    const pressaoAlvo = pressaoEnvelope(progress, this.pressaoAlvo)
    this.pressaoAtual = reduced
      ? pressaoAlvo
      : damp(this.pressaoAtual, pressaoAlvo, PRESSAO_LAMBDA, dt)
    this.material.uniforms['uGain']!.value = TWIG_GAIN * this.pressaoAtual
```

Atualize o comentário da classe ("a primeira tag escolhe o tom" → "a
primeira tag escolhe a pressão da pena") e o comentário do `update` que
cita "a cor já fazem" → "a pressão já fazem".

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/world/__tests__/PostWorld.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: O mundo bespoke em tinta**

`content/worlds/como-cheguei-aqui.ts`, import, junto dos outros
`../../src/...` (linhas 37–39):
`import { INK, INK_REST } from '../../src/world/palette'`.

Linhas 44–66 viram:

```ts
/*
 * Espelho exato de `src/world/palette.ts`. Nenhuma cor nova entra na cena —
 * e nenhuma cor: o mundo é tinta, como a árvore. A única cor do site é o gato.
 */
/** Linha em repouso, a mesma da árvore. */
const TINTA = INK_REST
/** Crista, borda, o que sangra. */
const TINTA_ACESA = INK

/*
 * Constantes de leitura, nunca mutadas: quem deriva copia delas pra uma cor
 * da instância. O módulo é reaproveitado entre visitas, então mutar uma
 * destas vazaria estado de uma leitura pra próxima.
 */
const COR_TINTA = new Color(TINTA)
const COR_TINTA_ACESA = new Color(TINTA_ACESA)
```

Linhas 509–510: `uRestColor: { value: new Color(TINTA) }`,
`uEdgeColor: { value: new Color(TINTA_ACESA) }`.

Linha 720: `clarao.style.background = 'var(--ink)'` — o clarão é DOM, e no
DOM a tinta é o token. No papel é um borrão preto, na noite um clarão
branco; o teto de opacidade e o rate limit (WCAG 2.3.1) não mudam, porque a
inversão não altera a magnitude da variação de luminância.

Linhas 744–745: `corRepouso: new Color(TINTA)`, `corBorda: new Color(TINTA_ACESA)`.

Linhas 761–764 viram:

```ts
    // Sai pro traço pesado com a sirene e volta pro traço da árvore antes do
    // fim — contrato cláusula 3. O leitor sai por onde entrou.
    const quente = beat(progress, ...JANELAS.sirene) * (1 - beat(progress, ...JANELAS.regresso))
    m.corRepouso.copy(COR_TINTA).lerp(COR_TINTA_ACESA, quente * DERIVA_QUENTE)
```

(a linha de `m.corBorda` some — a borda já é a tinta acesa e não tem pra
onde derivar). Apague `COR_AMBAR`, `COR_AMBAR_QUENTE`, `AMBAR` e o
comentário sobre o âmbar sem par quente.

- [ ] **Step 6: Teste de cor solta no mundo**

Acrescente a `src/world/__tests__/palette.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('../../../', import.meta.url))

describe('nenhuma cor fora da paleta', () => {
  // `src/world/` e `content/worlds/`: tudo que desenha no mundo. Um hex
  // literal fora de palette.ts é uma segunda paleta nascendo.
  const pastas = ['src/world', 'content/worlds']

  it.each(pastas)('%s não carrega hex próprio', (pasta) => {
    for (const nome of readdirSync(join(raiz, pasta))) {
      if (!nome.endsWith('.ts') || nome === 'palette.ts') continue
      const fonte = readFileSync(join(raiz, pasta, nome), 'utf8')
      const achado = /\b0x[0-9a-fA-F]{6}\b|['"]#[0-9a-fA-F]{3,6}['"]/.exec(fonte)
      expect(achado, `${pasta}/${nome}: ${achado?.[0]}`).toBeNull()
    }
  })
})
```

Run: `npx vitest run src/world/__tests__/palette.test.ts`
Expected: PASS. Se falhar apontando um arquivo, o hex é uma cor esquecida:
leve para `palette.ts` (se for tom do mundo) ou para o token de CSS (se for
DOM). Não afrouxe o regex.

- [ ] **Step 7: Suíte, typecheck, browser**

Run: `npm test && npm run typecheck`

`npm run dev`, abra `/blog` e o post `como-cheguei-aqui`, nos dois temas:
rua em tinta; a sirene engrossa o traço em vez de amarelar; o clarão do fim
é preto no papel e branco na noite; ao chegar ao fim (`progress ≥ 0.97`) o
traço volta ao da árvore. Abra um post gerado (qualquer outro): galhinhos
em tinta, ganho voltando a 1 no fim.

- [ ] **Step 8: Commit**

```bash
git add src/world/PostWorld.ts src/world/__tests__/PostWorld.test.ts content/worlds/como-cheguei-aqui.ts src/world/__tests__/palette.test.ts
git commit -m "feat: mundos dos posts em tinta — a tag escolhe a pressão da pena, não a cor"
```

---

### Task 8: Contrato, docs e verificação final

**Files:**
- Modify: `README.md:135-137`
- Modify: `package.json:4` (descrição)

- [ ] **Step 1: README — cláusula 3 do contrato**

Troque:

```
3. **Green in, green out.** The base hue starts at `--green` (`#4fe08f`) and
   may drift anywhere while the reader is inside the post, but must be back at
   green by `progress >= 0.97`. The reader leaves the way they came in.
```

por:

```
3. **Ink in, ink out.** The world is monochrome: lines start at `INK_REST`
   (`src/world/palette.ts`) with gain `1.0`, may vary in *weight* while the
   reader is inside the post, but must be back at gain `1.0` by
   `progress >= 0.97`. Hue never drifts — the only colour on the site is the
   cat. The reader leaves the way they came in.
```

Também no README, no parágrafo "Adding a bespoke world" que diz "tinted
toward a hue derived from the post's first tag", troque por "with the pen
pressure (line gain) derived from the post's first tag". E na tabela de
frontmatter, a linha de `tags`: "it seeds the colour a generated post-world
drifts toward" → "it seeds the pen pressure a generated post-world drifts
toward".

- [ ] **Step 2: `package.json` descrição**

`"description": "Three.js portfolio — scanned world, liquid glass, a cat on a branch."`
vira
`"description": "Three.js portfolio — a scanned world in ink on paper, a cat on a branch."`

- [ ] **Step 3: Build completo**

Run: `npm test && npm run typecheck && npm run build`
Expected: passa; `dist/` gerado.

- [ ] **Step 4: Verificação final no browser (os dois temas)**

`npm run preview` (serve `dist/`). Para cada tema, trocando a aparência do
macOS:

- `/?verify`, recarregue: intro. Use `__world.freezeScan(0.15)`, `(0.5)`,
  `(1)` + `__world.snap()` e tire screenshot de cada: o scan lê como tinta
  sangrando (papel) / luz (noite).
- Gato pousado: preto com forro `#ffc27a` (papel) / preto com halo âmbar
  (noite). Sem mancha ao redor no papel.
- `/blog`: rótulos legíveis em tinta; hover acende o galho.
- Um post até o fim: pressão volta a 1.
- Console: zero erros, zero avisos WebGL.
- Viewport 375×812: sem overflow horizontal, cards inteiros.
- DevTools → Rendering → `prefers-contrast: less`: `#1a1a1a`/`#fafafa`.
- DevTools → Rendering → `prefers-reduced-motion: reduce`: intro vira
  fade, gato já pousado, tudo como antes desta iniciativa.
- WCAG 1.4.12: no console, `document.head.insertAdjacentHTML('beforeend',
  '<style>* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important }</style>')`
  e role `/` e um post inteiro: nada corta, nada sobrepõe, nenhum overflow.
- Lighthouse (aba Accessibility) no `/`: contraste sem falhas.

Anote qualquer ajuste feito em `INK_REST`/`INK_FAINT`/`BLOOM_STRENGTH`
no commit.

- [ ] **Step 5: Commit**

```bash
git add README.md package.json
git commit -m "docs: contrato do mundo em tinta — tinta entra, tinta sai"
```

- [ ] **Step 6: Reportar**

Ao autor: o que mudou por tarefa, o que foi verificado no browser (com os
screenshots), os valores finais de `INK_REST`/`INK_FAINT`, e os dois pontos
abertos deixados de propósito: o corpo do gato cinza-escuro pelo fog no
papel (Task 6, Step 5) e os itens de a11y fora do escopo (§8 do spec).
