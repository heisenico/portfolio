# Milestone C — O Galho: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three things the shipped home page got wrong — the name, the
absence of motion below the fold, and a learning section that quantified
hobbies — and then build the blog: the same tree seen from inside, where each
post is an addressable branch that grows its own world, and the first post's
branch grows a wireframe suburb.

**Architecture:** Nothing is rebuilt. One WebGL context and one tree survive
every navigation; routes move the camera. Posts are Markdown compiled at build
time behind a virtual module. A post's world is generated from its own text by
default, and a post can replace that entirely by dropping
`content/worlds/<slug>.ts` — the first post does, and that bespoke world is
built from the *same* distance-gated wireframe shaders as the tree, so a
different environment never becomes a different site.

**Tech Stack:** Three.js (vanilla), Vite 8, TypeScript 7, Vitest 4,
`marked` + `yaml` (build-time only — see Task 4 for why not `gray-matter`),
Geist / Geist Mono via Fontsource.

**Spec:** `docs/superpowers/plans/2026-08-20-a-arvore.md` — this plan
implements its Milestone C (Tasks 8–13) and amends its Milestone A/B output.
Read that document's *Concept*, *Verified colour tokens* and *Confirmed
biography* sections before starting; they are not repeated here.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Brazilian Portuguese only.** Every user-facing string is pt-BR, including
  the `<noscript>` block, which currently ships English and must be fixed.
  `lang="pt-BR"` stays on `<html>`.
- **Everything lowercase.** Every user-facing string is authored lowercase in
  the source — brand names included (`react`, `next.js`, `youtube`,
  `github`, `base exchange`). Never `text-transform: lowercase`: a screen
  reader announces the underlying text, so a transform lies about what is
  written. Task 1 adds a test that fails the build on any uppercase letter.
- **The name is `nicholas ferrer alencar`.** `<title>`, `<h1>`, and the
  `<noscript>` heading, verbatim, with no appended descriptor.
- **The tree is never rebuilt.** Navigation changes the camera and which
  branches are lit. Regenerating geometry per route throws away the illusion.
- **Two routes plus posts:** `/`, `/blog`, `/blog/:slug`. No card grid, no tag
  filter, no project section.
- Palette and type tokens are already shipped and verified; use
  `src/styles/tokens.css` and add nothing to it that is not measured.
  Lowest measured contrast is 5.45:1 (`--ink-faint` on `--bg-lifted`).
- `prefers-reduced-motion: reduce` is honoured by every animation added here,
  including camera flights, scroll-driven reveals and the post worlds.
- Zero console errors and zero WebGL warnings on load is a release gate.
- Commit after each task. Never commit with a failing `npx tsc --noEmit` or a
  failing `npx vitest run`.

### Baseline, verified before this plan was written

`npx tsc --noEmit` clean. `npx vitest run` — 7 files, 86 tests, all passing.
Any task that leaves either red is not finished.

### Two configuration bugs to be aware of

The spec's Task 8 puts tests in `plugins/__tests__/`, but `vitest.config.ts`
has `include: ['src/**/*.test.ts']` and `tsconfig.json` has
`include: ["src", "vite.config.ts", "vitest.config.ts"]`. As shipped, those
tests would never run and that directory would never typecheck. Task 4 fixes
both. Do not skip that step believing the tests passed — an empty match is
reported as success by Vitest only until you check the file count.

### Intellectual property, for Task 9

The first post's world is an **homage**, not a reproduction. All geometry is
written from scratch in this repository. Do not extract, convert or embed any
asset, model, texture, sound or map layout from any commercial game. Do not put
a game's title, logo, wordmark or character names into UI chrome, the page
title, the world's class names or the site's own copy. Nicholas may name the
game in his own prose — that is his sentence about his own life, and ordinary
nominative reference. The scene is: two facing houses, a picket fence, a bus,
and mannequins, in green wireframe. Those are generic suburban objects.

---

## The world contract

Every post is a different branch, a different environment, a different story —
and still obviously the same site. That is only true if divergence is bounded.
Any world, generated or bespoke, must satisfy all seven:

1. **Wireframe grammar only.** `LineSegments` and `Points` with
   `AdditiveBlending` and `depthWrite: false`. No solid shaded meshes, no
   textures, no imported models.
2. **It assembles by wavefront.** Geometry is revealed by a distance-gated
   uniform, using `branchVertex` / `branchFragment` from
   `src/fx/shaders/branch.ts` directly, or a sibling in `src/fx/shaders/` that
   is a documented copy of that pair plus one extra gate. Things do not fade
   in; they are *scanned* in.
3. **Green in, green out.** The base hue starts at `--green` (`#4fe08f`) and
   may drift anywhere while the reader is inside the post, but must be back at
   green by `progress >= 0.97`. The reader leaves the way they came in.
4. **It grows out of the branch.** The world is anchored at
   `ctx.branch.tip` and never hides or replaces the tree. Flying out must
   reveal the tree still standing exactly where it was.
5. **Reading is the only clock.** Every beat is a function of
   `progress: 0..1`. Nothing autoplays. A reader who stops scrolling sees a
   still image, not a cutscene.
6. **Reduced motion snaps.** Under `prefers-reduced-motion: reduce` each beat
   jumps to its end state at the same progress value. No eased travel, no
   rotation, no full-screen flash above 0.15 opacity.
7. **`dispose()` returns the context to zero.** Every `BufferGeometry`,
   `Material` and DOM node the world created is freed. Leaving `/blog/:slug`
   and coming back must not grow memory.

---

## File structure

```
content/
  posts/2026-08-22-como-cheguei-aqui.md   the first post (scaffold prose)
  worlds/como-cheguei-aqui.ts             its bespoke world — "a rua"

plugins/
  posts.ts                                Vite plugin: markdown -> virtual:posts
  __tests__/posts.test.ts

src/
  posts.d.ts                              types for `virtual:posts`

  content/
    site.ts            identity, nav, links, footer        (rewritten lowercase)
    sobre.ts           home page prose                     (rewritten lowercase)
    paixoes.ts         NEW — replaces the years half of aprendizado.ts
    aprendizado.ts     what he is learning now / next only
    __tests__/caixa-baixa.test.ts   guards the lowercase rule
    __tests__/paixoes.test.ts       grouping + ring layout

  core/
    CameraRig.ts       + flyTo, flyAlongBranch, setScroll
    __tests__/CameraRig.test.ts

  ui/
    Reveal.ts          NEW — scroll-reveal fallback for engines without view()
    Nav.ts             NEW — segmented glass pill
    PageHost.ts        + wires Reveal, + feeds scroll to the rig
    pages/HomePage.ts  + passions, lowercase, data-reveal
    pages/BlogPage.ts  NEW
    pages/PostPage.ts  NEW
    pages/NotFoundPage.ts NEW

  world/
    TrunkRings.ts      rewritten: one ring per passion, no years
    BranchLabels.ts    NEW — billboarded post labels
    PostWorld.ts       NEW — contract, generated default, escape hatch
    Wind.ts            NEW
    Fireflies.ts       NEW

  styles/
    motion.css         NEW — scroll-driven reveals and the shared easings
    prose.css          NEW — the reader pane
```

`src/content/aprendizado.ts` keeps `agora` and `depois` and loses `jaAprendi`
and `anosDe`. Both are deleted, not deprecated.

---

# Part 1 — the corrections

Three fixes to what is already live. They land first because Milestone C
inherits all three: the blog's copy must be lowercase, its post branches reuse
the reveal system, and a blog that quantifies nothing should not sit next to a
home page that quantifies hobbies.

---

### Task 1: lowercase, and the right name

**Files:**
- Modify: `index.html`, `src/content/site.ts`, `src/content/sobre.ts`,
  `src/content/aprendizado.ts`, `src/ui/pages/HomePage.ts`
- Create: `src/content/__tests__/caixa-baixa.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `site.perfil.nome === 'nicholas ferrer alencar'`; every exported
  string in `src/content/` is lowercase. No signature changes.

The `<noscript>` block currently ships English prose and the old English job
title. It is user-facing text on the one path where the site has nothing else,
so it is in scope.

- [ ] **Step 1: Write the failing guard test**

Create `src/content/__tests__/caixa-baixa.test.ts`:

```ts
/**
 * A regra da caixa baixa, como teste em vez de como combinado.
 *
 * O site inteiro é escrito em minúscula. Isso é decisão de design, e decisão
 * de design que mora só na cabeça de alguém volta atrás na primeira edição de
 * texto às onze da noite. Aqui ela quebra o build.
 *
 * `text-transform: lowercase` resolveria visualmente e mentiria pro leitor de
 * tela, que anuncia o texto de verdade — por isso a minúscula é escrita na
 * fonte, e é isto que este teste verifica.
 */

import { describe, expect, it } from 'vitest'
import { aprendizado } from '../aprendizado'
import { site } from '../site'
import { sobre } from '../sobre'

/** Chaves cujo valor é URL, id ou enum — não texto que alguém lê. */
const NAO_E_TEXTO = new Set(['href', 'id', 'categoria'])

/**
 * Coleta toda string de texto visível. Item de array herda a chave do array,
 * porque `corpo: string[]` é um parágrafo por posição e não tem chave própria.
 */
export function textosVisiveis(valor: unknown, chave = '', achados: string[] = []): string[] {
  if (typeof valor === 'string') {
    if (!NAO_E_TEXTO.has(chave)) achados.push(valor)
    return achados
  }
  if (Array.isArray(valor)) {
    for (const item of valor) textosVisiveis(item, chave, achados)
    return achados
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) textosVisiveis(v, k, achados)
  }
  return achados
}

describe('textosVisiveis', () => {
  it('ignora href, id e categoria', () => {
    expect(textosVisiveis({ href: 'https://X.com', rotulo: 'x' })).toEqual(['x'])
  })
  it('desce em array de string herdando a chave', () => {
    expect(textosVisiveis({ corpo: ['um', 'dois'] })).toEqual(['um', 'dois'])
  })
})

describe('todo texto do site é minúsculo', () => {
  const todos = [
    ...textosVisiveis(site),
    ...textosVisiveis(sobre),
    ...textosVisiveis(aprendizado),
  ]

  // Se o caminhador parar de achar as strings, o teste passa por vazio. Este
  // piso é o que impede isso de acontecer em silêncio.
  it('encontra a cópia toda', () => {
    expect(todos.length).toBeGreaterThan(20)
  })

  it('não tem uma única maiúscula', () => {
    expect(todos.filter((t) => t !== t.toLocaleLowerCase('pt-BR'))).toEqual([])
  })
})

describe('o nome', () => {
  it('é o nome inteiro, minúsculo', () => {
    expect(site.perfil.nome).toBe('nicholas ferrer alencar')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/content/__tests__/caixa-baixa.test.ts`
Expected: FAIL — the uppercase filter returns a non-empty array
(`'Nicholas Ferrer'`, `'Engenheiro de software'`, and so on), and the name
assertion fails.

- [ ] **Step 3: Rewrite `src/content/site.ts`**

Only the string values change. Keep every comment, every `href`, and the
`Link` interface exactly as they are.

```ts
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
```

- [ ] **Step 4: Rewrite the strings in `src/content/sobre.ts`**

```ts
export const sobre = {
  lead: 'cuido de arquitetura e direção de front-end na base exchange, com react, next.js e javascript.',

  secoes: [
    {
      id: 'sobre',
      titulo: 'sobre',
      corpo: [
        'trabalho com interface há tempo suficiente pra saber que a decisão de arquitetura e a decisão de design quase sempre são a mesma decisão, tomada duas vezes.',
        'boa parte da minha carreira aconteceu dentro de empresa, em time, resolvendo problema de gente de verdade. é esse tipo de trabalho que eu gosto de fazer.',
      ],
    },
    {
      id: 'fora',
      titulo: 'fora do trabalho',
      corpo: [
        'leio, vejo filme e passo tempo demais aprendendo coisa que eu ainda não sei fazer.',
        'não uso rede social. mantenho um canal no youtube que funciona como diário, e onde também falo de javascript.',
      ],
    },
  ] satisfies Secao[],

  convite: 'pra trabalho criativo, de engenharia a design:',
}
```

- [ ] **Step 5: Lowercase the two remaining strings in `src/content/aprendizado.ts`**

`agora.nome` becomes `'edição de vídeo no premiere'`, `agora.porque` becomes
`'pra contar melhor as coisas que eu faço.'`, `depois.nome` becomes
`'tocar sax'`, `depois.porque` becomes `'porque sim.'`. Leave `jaAprendi` and
`anosDe` alone — Task 2 deletes them, and deleting them here would break
`TrunkRings` mid-task.

- [ ] **Step 6: Run and watch the guard pass**

Run: `npx vitest run src/content/__tests__/caixa-baixa.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Lowercase the literals inside `HomePage.ts`**

Four headings are hardcoded in the template rather than living in the content
layer: `Aprendendo`, `Onde me achar`, `Agora`, `Depois`. Lowercase all four.

```html
        <h2 id="sec-aprendendo">aprendendo</h2>
```
```html
          <dt><span class="ponto is-agora" aria-hidden="true"></span>agora</dt>
```
```html
          <dt><span class="ponto" aria-hidden="true"></span>depois</dt>
```
```html
        <h2 id="sec-onde">onde me achar</h2>
```

- [ ] **Step 8: Rewrite the head and the `<noscript>` block in `index.html`**

```html
    <title>nicholas ferrer alencar</title>
    <meta
      name="description"
      content="nicholas ferrer alencar — engenheiro de software, do rio, morando no interior. arquitetura e front-end com react, next.js e javascript."
    />
```

```html
    <noscript>
      <div class="noscript">
        <h1>nicholas ferrer alencar</h1>
        <p>
          engenheiro de software. esta página monta o conteúdo dela com javascript e webgl.
          habilite javascript, ou me ache em
          <a href="https://github.com/heisenico">github.com/heisenico</a>.
        </p>
      </div>
    </noscript>
```

- [ ] **Step 9: Confirm no uppercase survives in the built copy**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Then: `grep -oE '(Nicholas|Engenheiro|Aprendendo|Onde me achar|Staff Front-End)' dist/assets/*.js dist/index.html`
Expected: no matches, exit code 1 from grep.

- [ ] **Step 10: Browser-verify**

Run `npm run dev`, open `/`. Expected: the tab reads `nicholas ferrer alencar`;
the `<h1>` reads `nicholas ferrer alencar`; no capital letter anywhere on the
page. Zero console errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "design: the whole site in lowercase, and the whole name"
```

---

### Task 2: passions instead of years

**Files:**
- Create: `src/content/paixoes.ts`, `src/content/__tests__/paixoes.test.ts`
- Modify: `src/content/aprendizado.ts`, `src/world/TrunkRings.ts`,
  `src/ui/pages/HomePage.ts`, `src/main.ts`, `src/styles/ui.css`,
  `src/content/__tests__/caixa-baixa.test.ts`
- Delete: `Habilidade`, `jaAprendi`, `anosDe` from `src/content/aprendizado.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type CategoriaId = 'corpo' | 'maos'
  export interface Paixao { nome: string; categoria: CategoriaId; nota?: string }
  export interface Grupo { categoria: CategoriaId; rotulo: string; itens: Paixao[] }
  export const CATEGORIAS: readonly { id: CategoriaId; rotulo: string }[]
  export const paixoes: Paixao[]
  export function agruparPaixoes(lista: Paixao[]): Grupo[]
  export function alturasDosAneis(grupos: number[], de: number, ate: number, folga: number): number[][]
  ```
  `TrunkRings` constructor changes to `constructor(grupos: Grupo[])`.
  The DOM event `skill-hover` is renamed `paixao-hover`, detail
  `{ index: number | null }` where `index` is the flat index across all
  passions in `CATEGORIAS` order.

One ring per passion, all the same weight. The old trunk drew one circle per
*year*, which is why surf read as a thick band and yoga as two threads. Take
the years out and that basis is gone, so the ring becomes a countable thing
instead of a measured one: five passions, five rings, grouped into two bands.
The trunk still says something true and no longer says how long.

Grouping them is not decoration — it is what stops five equal rings from
reading as an arbitrary stack. Two bands with a visible gap between them is a
shape; five evenly spaced rings is a barcode.

- [ ] **Step 1: Write the failing tests**

Create `src/content/__tests__/paixoes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CATEGORIAS, agruparPaixoes, alturasDosAneis, paixoes, type Paixao } from '../paixoes'

describe('agruparPaixoes', () => {
  it('segue a ordem de CATEGORIAS, não a ordem da lista', () => {
    const lista: Paixao[] = [
      { nome: 'cozinhar', categoria: 'maos' },
      { nome: 'surf', categoria: 'corpo' },
    ]
    expect(agruparPaixoes(lista).map((g) => g.categoria)).toEqual(['corpo', 'maos'])
  })

  it('preserva a ordem de entrada dentro de cada categoria', () => {
    const lista: Paixao[] = [
      { nome: 'yoga', categoria: 'corpo' },
      { nome: 'surf', categoria: 'corpo' },
    ]
    expect(agruparPaixoes(lista)[0]!.itens.map((p) => p.nome)).toEqual(['yoga', 'surf'])
  })

  it('descarta categoria vazia em vez de emitir um grupo sem nada', () => {
    expect(agruparPaixoes([{ nome: 'surf', categoria: 'corpo' }])).toHaveLength(1)
  })

  it('explode numa categoria que não existe, em vez de sumir com a paixão', () => {
    const torta = [{ nome: 'x', categoria: 'cabeca' }] as unknown as Paixao[]
    expect(() => agruparPaixoes(torta)).toThrow(/cabeca/)
  })

  it('a lista de verdade cabe inteira nos grupos', () => {
    const total = agruparPaixoes(paixoes).reduce((n, g) => n + g.itens.length, 0)
    expect(total).toBe(paixoes.length)
  })
})

describe('alturasDosAneis', () => {
  it('um anel só fica no meio do vão', () => {
    expect(alturasDosAneis([1], -2, 2, 1.5)).toEqual([[0]])
  })

  it('preenche o vão inteiro, seja qual for a contagem', () => {
    for (const grupos of [[2], [3, 2], [1, 1, 1], [6, 4]]) {
      const ys = alturasDosAneis(grupos, -2, 2, 1.5).flat()
      expect(ys[0]).toBeCloseTo(-2, 5)
      expect(ys.at(-1)).toBeCloseTo(2, 5)
    }
  })

  it('sobe sempre, nunca repete altura', () => {
    const ys = alturasDosAneis([3, 2], -2, 2, 1.5).flat()
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!)
  })

  it('o vão entre bandas é maior que o vão dentro de uma banda', () => {
    const [a, b] = alturasDosAneis([2, 2], -2, 2, 1.5) as [number[], number[]]
    const dentro = a[1]! - a[0]!
    const entre = b[0]! - a[1]!
    expect(entre).toBeGreaterThan(dentro)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(alturasDosAneis([], -2, 2, 1.5)).toEqual([])
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/content/__tests__/paixoes.test.ts`
Expected: FAIL — cannot resolve `../paixoes`.

- [ ] **Step 3: Write `src/content/paixoes.ts`**

```ts
/**
 * Coisas que ele aprendeu a fazer e gosta de fazer.
 *
 * Sem anos. A versão anterior media cada hobby em tempo — "surf, 12 anos" —
 * e transformava gosto em currículo: quem dança há três anos parecia dançar
 * menos do que quem surfa há doze, o que não quer dizer nada sobre nenhum dos
 * dois. O que interessa é que a pessoa sabe fazer, não desde quando.
 *
 * As categorias existem porque cinco linhas soltas viram uma lista qualquer.
 * Separadas em "com o corpo" e "com as mãos", viram duas ideias — e no tronco
 * viram duas bandas de anéis com um vão entre elas, que é uma forma, em vez de
 * cinco anéis igualmente espaçados, que é um código de barras.
 *
 * Pra acrescentar uma paixão: uma linha em `paixoes`. Os anéis se redistribuem
 * sozinhos pelo mesmo trecho do tronco — ver `alturasDosAneis`.
 */

export type CategoriaId = 'corpo' | 'maos'

export interface Paixao {
  nome: string
  categoria: CategoriaId
  /** Uma linha, opcional. Sem nota é melhor que com nota inventada. */
  nota?: string
}

export interface Grupo {
  categoria: CategoriaId
  rotulo: string
  itens: Paixao[]
}

/** A ordem daqui é a ordem na página e no tronco, de baixo pra cima. */
export const CATEGORIAS = [
  { id: 'corpo', rotulo: 'com o corpo' },
  { id: 'maos', rotulo: 'com as mãos' },
] as const satisfies readonly { id: CategoriaId; rotulo: string }[]

export const paixoes: Paixao[] = [
  { nome: 'surf', categoria: 'corpo', nota: 'o mar não negocia.' },
  { nome: 'forró', categoria: 'corpo', nota: 'dançar é a única coisa que me tira da cabeça.' },
  { nome: 'yoga', categoria: 'corpo' },
  { nome: 'cozinhar', categoria: 'maos' },
  { nome: 'cerâmica', categoria: 'maos' },
]

export function agruparPaixoes(lista: Paixao[]): Grupo[] {
  const validas = new Set<string>(CATEGORIAS.map((c) => c.id))
  for (const p of lista) {
    // Uma categoria com erro de digitação sumiria da página em silêncio, e o
    // silêncio é pior que o build vermelho.
    if (!validas.has(p.categoria)) {
      throw new Error(`paixoes: "${p.nome}" está na categoria desconhecida "${p.categoria}"`)
    }
  }

  return CATEGORIAS.map((c) => ({
    categoria: c.id,
    rotulo: c.rotulo,
    itens: lista.filter((p) => p.categoria === c.id),
  })).filter((g) => g.itens.length > 0)
}

/**
 * Distribui os anéis pelo trecho `de`..`ate` do tronco.
 *
 * O trecho é fixo: cinco paixões e onze paixões ocupam a mesma altura, só que
 * mais apertadas. Espaçamento constante faria uma lista longa subir tronco
 * acima até a copa.
 *
 * `folga` é quantos passos de anel vale o vão entre uma banda e a seguinte.
 *
 * @returns uma lista de alturas por grupo, na mesma ordem de `grupos`.
 */
export function alturasDosAneis(
  grupos: number[],
  de: number,
  ate: number,
  folga: number,
): number[][] {
  const total = grupos.reduce((n, g) => n + g, 0)
  if (total === 0) return []
  if (total === 1) return grupos.map((n) => (n === 1 ? [(de + ate) / 2] : []))

  const passos = total - 1 + (grupos.length - 1) * folga
  const passo = (ate - de) / passos

  let cursor = de
  return grupos.map((n, g) => {
    const alturas: number[] = []
    for (let i = 0; i < n; i++) {
      alturas.push(cursor)
      if (i < n - 1) cursor += passo
    }
    if (g < grupos.length - 1) cursor += passo * (1 + folga)
    return alturas
  })
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run src/content/__tests__/paixoes.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Strip the years out of `src/content/aprendizado.ts`**

Delete the `Habilidade` interface, the `jaAprendi` array and the `anosDe`
function. What remains is only what he is learning now and next:

```ts
/**
 * O que estou aprendendo e o que vem depois.
 *
 * A parte do site que muda com o tempo, que é o que faz valer uma segunda
 * visita. O que ele já sabe fazer mora em `paixoes.ts` — separado porque é uma
 * lista que só cresce, e esta aqui é uma lista que se substitui.
 */

export interface Aprendendo {
  nome: string
  porque: string
}

export const aprendizado = {
  agora: {
    nome: 'edição de vídeo no premiere',
    porque: 'pra contar melhor as coisas que eu faço.',
  } satisfies Aprendendo,

  depois: {
    nome: 'tocar sax',
    porque: 'porque sim.',
  } satisfies Aprendendo,
}
```

- [ ] **Step 6: Add `paixoes` to the lowercase guard**

In `src/content/__tests__/caixa-baixa.test.ts`, import
`{ CATEGORIAS, paixoes }` from `../paixoes` and extend the `todos` array with
`...textosVisiveis(paixoes)` and `...textosVisiveis(CATEGORIAS)`. `categoria`
and `id` are already in `NAO_E_TEXTO`, so only `nome`, `nota` and `rotulo`
are checked.

Run: `npx vitest run src/content/__tests__/`
Expected: PASS.

- [ ] **Step 7: Rewrite `src/world/TrunkRings.ts`**

```ts
/**
 * Anéis no tronco — um por paixão, agrupados por categoria.
 *
 * A versão anterior desenhava um círculo por ano, e o tronco virava um gráfico
 * de barras vertical: doze anos de surf eram uma faixa grossa, um ano de yoga
 * era um fio. Tirar os anos tira essa base, e o anel passa a ser uma coisa
 * contável em vez de medida — uma paixão, um anel.
 *
 * As bandas sobem na ordem de `CATEGORIAS`, com um vão maior entre bandas do
 * que entre anéis. É esse vão que faz a pilha ter forma.
 *
 * Passar o mouse na paixão na página acende o anel dela no mundo. É o único
 * elo direto entre o DOM e a cena, e existe pra que a página e o mundo sejam
 * duas vistas do mesmo fato em vez de duas camadas empilhadas.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
} from 'three'
import { alturasDosAneis, type Grupo } from '../content/paixoes'
import { clamp01, damp } from '../util/tween'

/** Segments per circle. Low enough to stay cheap, high enough to read round. */
const SEGMENTS = 72
const RING_RADIUS = 0.86
/** Trecho do tronco que os anéis ocupam, seja qual for a contagem. */
const DE = -1.9
const ATE = 1.3
/** O vão entre bandas vale este tanto de passo de anel. */
const FOLGA = 2.2

const REST_OPACITY = 0.3
const LIT_OPACITY = 0.9

export class TrunkRings {
  readonly group = new Group()

  private materials: LineBasicMaterial[] = []
  private targets: number[] = []
  private current: number[] = []
  private geometry = circleGeometry(RING_RADIUS)
  private restColor = new Color(0x4fe08f)
  private litColor = new Color(0xd9ffe9)
  private highlighted: number | null = null

  constructor(grupos: Grupo[]) {
    const alturas = alturasDosAneis(
      grupos.map((g) => g.itens.length),
      DE,
      ATE,
      FOLGA,
    )

    grupos.forEach((grupo, g) => {
      grupo.itens.forEach((_paixao, i) => {
        // Um material por anel: o realce é por paixão, não por banda.
        const material = new LineBasicMaterial({
          color: this.restColor.clone(),
          transparent: true,
          opacity: REST_OPACITY,
          depthWrite: false,
          blending: AdditiveBlending,
        })
        this.materials.push(material)
        this.targets.push(REST_OPACITY)
        this.current.push(REST_OPACITY)

        const ring = new LineLoop(this.geometry, material)
        ring.rotation.x = Math.PI / 2
        ring.position.y = alturas[g]![i]!
        this.group.add(ring)
      })
    })

    this.group.frustumCulled = false
  }

  /** Acende uma paixão pelo índice achatado, ou `null` pra apagar tudo. */
  setHighlight(index: number | null): void {
    this.highlighted = index
    for (let i = 0; i < this.targets.length; i++) {
      this.targets[i] = index === i ? LIT_OPACITY : REST_OPACITY
    }
  }

  /**
   * @param reveal 0..1 ao longo da varredura de entrada — os anéis chegam com
   *        a árvore em vez de estarem lá antes dela existir.
   */
  update(dt: number, elapsed: number, reveal: number): void {
    const gate = clamp01((reveal - 0.35) / 0.4)

    for (let i = 0; i < this.materials.length; i++) {
      const material = this.materials[i]!
      this.current[i] = damp(this.current[i]!, this.targets[i]!, 9, dt)

      // Uma respiração lenta, defasada por anel pra nunca pulsarem juntos.
      const breath = 1 + Math.sin(elapsed * 0.7 + i * 1.9) * 0.08
      material.opacity = this.current[i]! * gate * breath

      const lit = this.highlighted === i ? 1 : 0
      material.color.copy(this.restColor).lerp(this.litColor, lit * 0.85)
    }
  }

  dispose(): void {
    this.geometry.dispose()
    for (const material of this.materials) material.dispose()
  }
}

/** A flat circle in the XY plane; the caller rotates it onto the trunk. */
function circleGeometry(radius: number): BufferGeometry {
  const points = new Float32Array(SEGMENTS * 3)
  for (let i = 0; i < SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * Math.PI * 2
    points[i * 3] = Math.cos(angle) * radius
    points[i * 3 + 1] = Math.sin(angle) * radius
    points[i * 3 + 2] = 0
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(points, 3))
  return geometry
}
```

One geometry shared by every ring now, rather than one per year — `dispose()`
frees it once. The old version leaked nothing but allocated a fresh
72-point buffer per year.

- [ ] **Step 8: Rewrite the passions section in `src/ui/pages/HomePage.ts`**

Replace the import of `{ anosDe, aprendizado }` with:

```ts
import { aprendizado } from '../../content/aprendizado'
import { agruparPaixoes, paixoes } from '../../content/paixoes'
```

Rename the exported detail interface and the event:

```ts
/** Emitido ao passar o mouse numa paixão; o tronco escuta. */
export interface PaixaoHoverDetail {
  index: number | null
}
```

Replace the `<ul class="habilidades">` block with grouped output. The flat
index is computed as the running count so it matches `TrunkRings`'s ring
order exactly — both walk `agruparPaixoes` output in the same order, which is
the only reason a single number can address a ring:

```ts
    const grupos = agruparPaixoes(paixoes)
    let indice = 0
    const paixoesHtml = grupos
      .map(
        (grupo) => `
          <div class="grupo">
            <h3 class="grupo-rotulo">${esc(grupo.rotulo)}</h3>
            <ul class="paixoes">
              ${grupo.itens
                .map(
                  (p) => `
                    <li class="paixao" data-paixao-index="${indice++}">
                      <span class="paixao-nome">${esc(p.nome)}</span>
                      ${p.nota ? `<span class="paixao-nota">${esc(p.nota)}</span>` : ''}
                    </li>`,
                )
                .join('')}
            </ul>
          </div>`,
      )
      .join('')
```

and interpolate `${paixoesHtml}` where the old list was. Rename
`this.skillRows` to `this.paixaoRows`, its query selector to `.paixao`, the
dataset read to `dataset['paixaoIndex']`, and the dispatched event name to
`'paixao-hover'`.

- [ ] **Step 9: Rewire `src/main.ts`**

```ts
import { aprendizado } from './content/aprendizado'
```
becomes
```ts
import { agruparPaixoes, paixoes } from './content/paixoes'
```

```ts
const rings = new TrunkRings(agruparPaixoes(paixoes))
```

```ts
// A página e o mundo são duas vistas do mesmo fato: passar o mouse numa
// paixão acende o anel dela no tronco.
document.addEventListener('paixao-hover', (event) => {
  rings.setHighlight((event as CustomEvent<PaixaoHoverDetail>).detail.index)
})
```

and the type import becomes `import type { PaixaoHoverDetail } from './ui/pages/HomePage'`.
`aprendizado` is no longer imported in `main.ts`; with `noUnusedLocals` on,
leaving it in fails the typecheck.

- [ ] **Step 10: Restyle in `src/styles/ui.css`**

Replace the `.habilidades` / `.habilidade` / `.hab-nome` / `.hab-anos` rules
with:

```css
/* ---------- Paixões ---------- */

.grupo + .grupo {
  margin-top: var(--space-5);
}

.grupo-rotulo {
  font-size: var(--text-xs);
  font-weight: 400;
  color: var(--ink-faint);
  margin: 0 0 var(--space-2);
}

.paixoes {
  list-style: none;
  margin: 0;
  padding: 0;
}

.paixao {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  font-size: var(--text-base);
  letter-spacing: var(--track-snug);
  cursor: default;
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.paixao + .paixao {
  border-top: 1px solid var(--rule);
}

.paixao-nome {
  color: var(--ink);
}

.paixao-nota {
  font-size: var(--text-sm);
  color: var(--ink-faint);
  text-align: right;
}

/*
 * Apontar pra uma paixão apaga as outras. `:has()` faz isso sem uma linha de
 * JS e sem uma classe de estado — o container sabe que alguém está sob o
 * ponteiro, então quem não está recua. É o mesmo gesto que acende o anel no
 * tronco, dito duas vezes.
 */
.folha:has(.paixao:hover) .paixao:not(:hover) {
  opacity: 0.42;
}
```

In the `@media (max-width: 560px)` block, change the `.habilidade` selector to
`.paixao`. In the `@media (prefers-reduced-motion: reduce)` block, add
`.paixao` to the `transition: none` list. In the pointer-events allowlist near
the top, change `.habilidade` to `.paixao`.

- [ ] **Step 11: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, and the total is now 86 + 5 + 10 = 101 tests.

- [ ] **Step 12: Browser-verify**

Open `/`. Expected: two groups — `com o corpo` (surf, forró, yoga) and
`com as mãos` (cozinhar, cerâmica) — with no numbers anywhere. Hovering
`cerâmica` dims the other four rows and lights the topmost ring on the trunk;
hovering `surf` lights the bottommost. Five rings total, two bands, a visible
gap between them. Zero console errors.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "design: the trunk counts passions instead of measuring years"
```

---

### Task 3: motion below the fold

**Files:**
- Create: `src/styles/motion.css`, `src/ui/Reveal.ts`
- Modify: `src/styles/ui.css`, `src/ui/PageHost.ts`, `src/ui/pages/HomePage.ts`,
  `src/core/CameraRig.ts`, `src/main.ts`
- Test: `src/core/__tests__/CameraRig.test.ts` (created here, extended in Task 5)

**Interfaces:**
- Consumes: `Quality.reducedMotion`, `PageHost.scrollProgress`.
- Produces:
  ```ts
  // src/ui/Reveal.ts
  export type RevealMode = 'css' | 'js' | 'off'
  export function detectRevealMode(reducedMotion: boolean): RevealMode
  export class Reveal {
    constructor(mode: RevealMode)
    observe(root: HTMLElement): void
    dispose(): void
  }

  // src/core/CameraRig.ts
  export function scrollDolly(t: number): { ganhoRaio: number; subida: number }
  // method on CameraRig:
  setScroll(t: number): void
  ```

The opening sequence is the best thing on the page and then the page goes
dead: scroll past the fold and nothing moves except the parallax. This gives
every block below the fold the same character of arrival — a rise out of the
dark — and gives the world one slow response to the reader descending.

**Technique, and why.** Scroll-driven CSS animations (`animation-timeline:
view()`) run on the compositor, need no scroll listener, and get the
element's own progress through the viewport for free. Chromium and recent
Safari have them; Firefox does not at time of writing. So the mode is
detected once in JS and written to the `<html>` element, and the stylesheet
has two branches off that one attribute. An `@supports` block would have
covered the CSS branch but not the fallback, which needs the observer either
way — one detection is better than two that can disagree.

**Deliberately not used: the View Transition API.** `document.startViewTransition`
would be the obvious modern choice for the route change, but it snapshots
participating elements to textures, and `#ui` on a long post is several
viewports tall. Worse, the snapshot freezes the frame while the world behind
it must keep rendering live — the whole point of the persistent canvas. The
existing opacity crossfade in `PageHost` stays.

- [ ] **Step 1: Write the failing `scrollDolly` test**

Create `src/core/__tests__/CameraRig.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { scrollDolly } from '../CameraRig'

describe('scrollDolly', () => {
  it('não faz nada no topo da página', () => {
    expect(scrollDolly(0)).toEqual({ ganhoRaio: 1, subida: 0 })
  })

  it('afasta e sobe a câmera no fim da página', () => {
    const d = scrollDolly(1)
    expect(d.ganhoRaio).toBeGreaterThan(1)
    expect(d.subida).toBeGreaterThan(0)
  })

  it('cresce sem voltar atrás', () => {
    let anterior = -Infinity
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const { ganhoRaio } = scrollDolly(t)
      expect(ganhoRaio).toBeGreaterThanOrEqual(anterior)
      anterior = ganhoRaio
    }
  })

  it('trava fora de 0..1, porque scrollProgress já vazou desses limites antes', () => {
    expect(scrollDolly(-3)).toEqual(scrollDolly(0))
    expect(scrollDolly(9)).toEqual(scrollDolly(1))
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/core/__tests__/CameraRig.test.ts`
Expected: FAIL — `scrollDolly` is not exported from `../CameraRig`.

- [ ] **Step 3: Add `scrollDolly` and `setScroll` to `src/core/CameraRig.ts`**

Add to the imports: `import { clamp01, damp, easeInOutCubic } from '../util/tween'`.

Add below the existing constants:

```ts
/** Quanto a órbita cresce da primeira à última linha da página. */
const DOLLY_GANHO = 0.22
/** Quanto o ponto de mira sobe, em unidades de mundo. */
const DOLLY_SUBIDA = 2.2

/**
 * Resposta da câmera à rolagem.
 *
 * A árvore recua e o olhar sobe conforme o leitor desce. Devagar e pouco: é
 * pra parecer que a página tem profundidade, não que a câmera está num trilho.
 * Puro e testado à parte porque a curva é a decisão, e o resto é encanamento.
 */
export function scrollDolly(t: number): { ganhoRaio: number; subida: number } {
  const e = easeInOutCubic(clamp01(t))
  return { ganhoRaio: 1 + DOLLY_GANHO * e, subida: DOLLY_SUBIDA * e }
}
```

Add two fields to the class, next to `azimuth` / `polar`:

```ts
  private scroll = 0
  private scrollTarget = 0
```

Add the setter next to `refit()`:

```ts
  /** 0 no topo da página, 1 no fim. Amortecido; pode ser chamado por frame. */
  setScroll(t: number): void {
    this.scrollTarget = clamp01(t)
  }
```

In `update()`, after the `azimuth` / `polar` damping and before the position
is computed:

```ts
    // Movimento reduzido tira o dolly inteiro: é deslocamento de câmera de
    // corpo inteiro, que é exatamente a classe de movimento que incomoda.
    this.scrollTarget = reduced ? 0 : this.scrollTarget
    this.scroll = damp(this.scroll, this.scrollTarget, 2.6, dt)
    const { ganhoRaio, subida } = scrollDolly(this.scroll)
    const raio = this.radius * ganhoRaio
```

then replace the three uses of `this.radius` in the `camera.position.set` call
with `raio`, and add `subida` to the focus height:

```ts
    const fx = this.focus.x + this.shiftX
    const fy = this.focus.y + this.shiftY + subida
    this.camera.position.set(
      fx + Math.sin(az) * cosPo * raio,
      fy + Math.sin(po) * raio + 1.2,
      this.focus.z + Math.cos(az) * cosPo * raio,
    )
    this.camera.lookAt(fx, fy, this.focus.z)
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run src/core/__tests__/CameraRig.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write `src/ui/Reveal.ts`**

```ts
/**
 * Entrada dos blocos conforme o leitor desce.
 *
 * O caminho bom é CSS puro: `animation-timeline: view()` dá a cada elemento a
 * própria passagem pela viewport como linha do tempo, roda no compositor e não
 * precisa de um único listener de scroll. Chromium e Safari recente têm;
 * Firefox ainda não.
 *
 * Por isso a detecção acontece uma vez, aqui, e vira um atributo no `<html>`.
 * O CSS tem dois ramos pendurados nesse atributo e mais nada — um `@supports`
 * cobriria o ramo nativo mas não o observer, e duas detecções que podem
 * discordar é pior que uma.
 *
 * Terceiro modo: `off`. Movimento reduzido não ganha versão suave da
 * animação, ganha ausência dela — nenhum atributo é escrito, nenhuma regra
 * casa, o conteúdo simplesmente está lá.
 */

export type RevealMode = 'css' | 'js' | 'off'

/** Distância antes da borda inferior em que um bloco começa a entrar. */
const MARGEM = '0px 0px -12% 0px'
/** Atraso entre irmãos, no modo de reserva. O nativo escalona sozinho. */
const ESCALONAMENTO_MS = 55

export function detectRevealMode(reducedMotion: boolean): RevealMode {
  if (reducedMotion) return 'off'
  const suporta =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline', 'view()')
  return suporta ? 'css' : 'js'
}

export class Reveal {
  private observer: IntersectionObserver | null = null

  constructor(private mode: RevealMode) {
    if (mode === 'off') {
      document.documentElement.removeAttribute('data-reveal-mode')
      return
    }
    document.documentElement.setAttribute('data-reveal-mode', mode)

    if (mode === 'js') {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            entry.target.classList.add('is-in')
            // Uma vez só. Um bloco que reaparece já foi lido; repetir a
            // entrada faria a página piscar na rolagem pra cima.
            this.observer?.unobserve(entry.target)
          }
        },
        { rootMargin: MARGEM, threshold: 0.05 },
      )
    }
  }

  /** Registra tudo que a página recém-montada marcou com `data-reveal`. */
  observe(root: HTMLElement): void {
    if (this.mode !== 'js' || !this.observer) return

    // O escalonamento é por vizinhança: irmãos entram em cascata, blocos
    // distantes não herdam o atraso de uma lista que ficou pra trás.
    const porPai = new Map<Element, number>()
    for (const el of root.querySelectorAll<HTMLElement>('[data-reveal]')) {
      const pai = el.parentElement ?? root
      const i = porPai.get(pai) ?? 0
      porPai.set(pai, i + 1)
      el.style.setProperty('--i', String(Math.min(i, 8)))
      el.style.setProperty('--escalonamento', `${ESCALONAMENTO_MS}ms`)
      this.observer.observe(el)
    }
  }

  dispose(): void {
    this.observer?.disconnect()
    this.observer = null
  }
}
```

`Math.min(i, 8)` caps the cascade: on a list of thirty links the thirtieth
would otherwise wait 1.6 seconds after the first.

- [ ] **Step 6: Write `src/styles/motion.css`**

```css
/*
 * Movimento.
 *
 * Uma curva só e um gesto só, repetidos. A abertura do site é uma varredura
 * que acende as coisas de baixo pra cima; tudo que entra depois faz a mesma
 * coisa em pequeno — sobe do escuro e a régua acima dele se desenha da
 * esquerda pra direita, que é a mesma frente de onda em duas dimensões.
 *
 * Os dois ramos aqui são o mesmo desenho por dois caminhos: `view()` quando o
 * motor tem, IntersectionObserver quando não tem. Sem atributo no `<html>`,
 * nada disso casa — que é o estado de movimento reduzido.
 */

:root {
  /* A saída que o resto do site já usa. Aqui ela ganha nome. */
  --ease-saida: cubic-bezier(0.22, 1, 0.36, 1);
  /*
   * Uma mola com ultrapassagem de ~12%, escrita como `linear()` em vez de
   * como keyframes. Serve pro indicador da navegação, que precisa passar do
   * ponto e voltar pra parecer que tem massa.
   */
  --ease-mola: linear(
    0, 0.402 7.4%, 0.874 15.9%, 1.055 21.4%, 1.117 26.6%, 1.09 34%, 1.001 46.6%,
    0.995 54.7%, 1
  );
  --sobe: 18px;
}

@keyframes subir {
  from {
    opacity: 0;
    transform: translateY(var(--sobe));
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes riscar {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

/* ---------- Caminho nativo: linha do tempo de rolagem ---------- */

html[data-reveal-mode='css'] [data-reveal] {
  animation: subir linear both;
  animation-timeline: view();
  animation-range: entry 8% cover 30%;
}

/* Linhas de lista entram mais curto: são pequenas e em série, e a mesma
   distância que fica bem num bloco de texto vira arrasto numa lista. */
html[data-reveal-mode='css'] [data-reveal='linha'] {
  animation-range: entry 4% cover 20%;
}

html[data-reveal-mode='css'] .bloco[data-reveal]::before {
  animation: riscar linear both;
  animation-timeline: view();
  animation-range: entry 6% cover 24%;
}

/* ---------- Caminho de reserva: observer ---------- */

html[data-reveal-mode='js'] [data-reveal] {
  opacity: 0;
  transform: translateY(var(--sobe));
  transition:
    opacity 620ms var(--ease-saida) calc(var(--i, 0) * var(--escalonamento, 0ms)),
    transform 620ms var(--ease-saida) calc(var(--i, 0) * var(--escalonamento, 0ms));
}

html[data-reveal-mode='js'] [data-reveal].is-in {
  opacity: 1;
  transform: none;
}

html[data-reveal-mode='js'] .bloco[data-reveal]::before {
  transform: scaleX(0);
  transition: transform 700ms var(--ease-saida);
}

html[data-reveal-mode='js'] .bloco[data-reveal].is-in::before {
  transform: scaleX(1);
}
```

- [ ] **Step 7: Turn the block separator into a drawable rule, in `src/styles/ui.css`**

The separator between blocks is currently `border-top` on `.bloco + .bloco`,
and a border cannot be animated from nothing to full width. Replace it:

```css
.bloco + .bloco {
  margin-top: var(--space-7);
  padding-top: var(--space-7);
}

/* A régua entre blocos é um pseudo-elemento e não uma borda, porque ela se
   desenha da esquerda pra direita quando o bloco entra — e `border-top` não
   tem como sair de largura zero. */
.bloco {
  position: relative;
}

.bloco + .bloco::before {
  content: '';
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 1px;
  background: var(--rule);
  transform-origin: left center;
}
```

Import the new sheet from `src/main.ts`, after `ui.css`:

```ts
import './styles/motion.css'
```

- [ ] **Step 8: Mark the elements in `src/ui/pages/HomePage.ts`**

Add `data-reveal` to each `<section class="bloco">` opening tag, and
`data-reveal="linha"` to each `<li class="paixao">` and each `<li>` in the
links list. The hero is left unmarked: the intro already owns its arrival, and
two systems animating the same element is how you get a flicker.

- [ ] **Step 9: Wire `Reveal` into `PageHost`**

In `src/ui/PageHost.ts`, import `{ Reveal, detectRevealMode } from './Reveal'`,
build one in the constructor and register each page after it mounts:

```ts
  private reveal: Reveal

  constructor(
    private root: HTMLElement,
    private quality: Quality,
  ) {
    this.reveal = new Reveal(detectRevealMode(quality.reducedMotion))
    addEventListener('resize', this.markDirty, { passive: true })
    addEventListener('scroll', this.markDirty, { passive: true })
  }
```

In `show()`, immediately after `page.mount(this.root)`:

```ts
    this.reveal.observe(this.root)
```

and in `dispose()`, before `this.active?.unmount()`:

```ts
    this.reveal.dispose()
```

- [ ] **Step 10: Feed scroll to the rig, in `src/main.ts`**

In the loop tick that already calls `host.update`:

```ts
loop.add((dt) => {
  host.update(dt, pointer)
  rig.setScroll(host.scrollProgress)
})
```

- [ ] **Step 11: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, 105 tests.

- [ ] **Step 12: Browser-verify, all three modes**

1. Chromium, default. Expected: `document.documentElement.dataset.revealMode`
   is `'css'`. Scrolling down, each block rises into place and its top rule
   draws left-to-right; list rows arrive slightly ahead of blocks. The tree
   drifts back and the framing rises slowly across the full scroll. Nothing
   re-animates on the way back up.
2. Force the fallback: in the console,
   `document.documentElement.dataset.revealMode = 'js'` will *not* create the
   observer, so instead edit `detectRevealMode` to `return 'js'` temporarily,
   reload, and confirm the same gesture with a per-sibling stagger. Revert.
3. Emulate `prefers-reduced-motion: reduce`, reload. Expected: no
   `data-reveal-mode` attribute at all, every block visible at rest, no camera
   dolly on scroll, no console error.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scroll-driven reveals and a camera that answers the scroll"
```

**Part 1 ends here.** `/` is now lowercase, correctly named, quantifies
nothing, and moves the whole way down.

---

# Part 2 — Milestone C: the tree from inside

---

### Task 4: the markdown pipeline

**Files:**
- Create: `plugins/posts.ts`, `plugins/__tests__/posts.test.ts`,
  `src/posts.d.ts`, `content/posts/2026-08-22-como-cheguei-aqui.md`
- Modify: `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces, from `virtual:posts`:
  ```ts
  export interface Post {
    slug: string
    titulo: string
    data: string        // AAAA-MM-DD
    resumo: string
    tags: string[]
    minutos: number
    html: string
    /** Parágrafos de prosa — vira a contagem de galhinhos do galho do post. */
    paragrafos: number
    rascunho: boolean
  }
  export const posts: Post[]  // mais novo primeiro
  ```
  and, from `plugins/posts.ts` for tests:
  `splitFrontmatter(raw)`, `parsePost(raw, filename)`, `readingMinutes(text)`,
  `slugFromFilename(filename)`, `countParagraphs(markdown)`, `postsPlugin()`.

Markdown compiles at build time. Shipping a Markdown parser to the browser
would cost hundreds of kilobytes to render text that cannot change after the
build.

**Deviation from the spec, deliberate.** The spec's Task 8 specifies
`gray-matter`. Two things make that the wrong pick here, both verified before
writing this plan:

1. `gray-matter` is CommonJS with an `export =` declaration. This project has
   `esModuleInterop` off and `verbatimModuleSyntax: true`, so
   `import matter from 'gray-matter'` does not typecheck, and the fix is
   loosening a compiler flag for the whole repository.
2. `gray-matter` parses YAML 1.1, where `data: 2026-08-22` becomes a `Date`
   object in whatever timezone the build machine is in — which is why the
   spec's own code carries an `instanceof Date` branch.

`yaml@2` (ESM-safe named exports, zero dependencies, YAML 1.2 core schema)
parses that same line to the string `'2026-08-22'`. Verified:
`parse('data: 2026-08-22').data` → `'2026-08-22'`, `typeof` `string`. The
frontmatter split it does not do is eight lines and becomes a tested function.

- [ ] **Step 1: Install the build-only dependencies**

```bash
npm i -D marked yaml
```

- [ ] **Step 2: Widen the two configs that would silently skip this directory**

`vitest.config.ts` currently matches only `src/**`. As shipped, every test in
this task would be collected as zero files and reported as a pass.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
  },
})
```

`tsconfig.json` — add `"plugins"` to `include`:

```json
  "include": ["src", "plugins", "vite.config.ts", "vitest.config.ts"]
```

- [ ] **Step 3: Write the failing tests**

Create `plugins/__tests__/posts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  countParagraphs,
  parsePost,
  readingMinutes,
  slugFromFilename,
  splitFrontmatter,
} from '../posts'

const raw = `---
titulo: olá, mundo
data: 2026-08-22
resumo: um primeiro texto.
tags: [meta]
---

<!-- reescrever -->

primeiro parágrafo com **negrito** e coração.

segundo parágrafo.

## um título

terceiro parágrafo.
`

describe('splitFrontmatter', () => {
  it('separa o bloco de cabeçalho do corpo', () => {
    const { frontmatter, body } = splitFrontmatter(raw)
    expect(frontmatter).toContain('titulo: olá, mundo')
    expect(frontmatter).not.toContain('primeiro parágrafo')
    expect(body.trimStart().startsWith('<!-- reescrever -->')).toBe(true)
  })

  it('aceita um arquivo sem cabeçalho nenhum', () => {
    expect(splitFrontmatter('só texto')).toEqual({ frontmatter: '', body: 'só texto' })
  })

  it('não confunde uma régua horizontal no meio do texto com o fim do cabeçalho', () => {
    const { body } = splitFrontmatter('---\ntitulo: x\n---\n\num\n\n---\n\ndois\n')
    expect(body).toContain('dois')
  })
})

describe('slugFromFilename', () => {
  it('tira o prefixo de data e a extensão', () => {
    expect(slugFromFilename('2026-08-22-como-cheguei-aqui.md')).toBe('como-cheguei-aqui')
  })
  it('deixa em paz um arquivo sem data', () => {
    expect(slugFromFilename('sobre-tudo.md')).toBe('sobre-tudo')
  })
})

describe('readingMinutes', () => {
  it('nunca devolve zero', () => expect(readingMinutes('oi')).toBe(1))
  it('cresce com o tamanho', () => {
    expect(readingMinutes('palavra '.repeat(400))).toBeGreaterThan(1)
  })
})

describe('countParagraphs', () => {
  it('conta prosa e ignora título', () => {
    expect(countParagraphs(splitFrontmatter(raw).body)).toBe(3)
  })
  it('ignora comentário html, que é andaime e não parágrafo', () => {
    expect(countParagraphs('<!-- reescrever -->\n\num parágrafo.')).toBe(1)
  })
  it('ignora bloco de código e régua', () => {
    expect(countParagraphs('```js\nx\n```\n\n---\n\num parágrafo.')).toBe(1)
  })
  it('nunca devolve zero, pra que um galho sempre tenha um galhinho', () => {
    expect(countParagraphs('')).toBe(1)
  })
})

describe('parsePost', () => {
  it('lê o cabeçalho', () => {
    const p = parsePost(raw, '2026-08-22-ola.md')
    expect(p.titulo).toBe('olá, mundo')
    expect(p.data).toBe('2026-08-22')
    expect(p.slug).toBe('ola')
    expect(p.tags).toEqual(['meta'])
    expect(p.rascunho).toBe(false)
    expect(p.paragrafos).toBe(3)
  })

  it('a data continua string, sem virar Date no fuso da máquina de build', () => {
    expect(typeof parsePost(raw, 'x.md').data).toBe('string')
  })

  it('renderiza markdown com acento inteiro', () => {
    const p = parsePost(raw, 'x.md')
    expect(p.html).toContain('<strong>negrito</strong>')
    expect(p.html).toContain('coração')
  })

  it('marca rascunho', () => {
    expect(parsePost(raw.replace('tags:', 'rascunho: true\ntags:'), 'x.md').rascunho).toBe(true)
  })

  it('explode sem titulo, em vez de publicar um post em branco', () => {
    expect(() => parsePost('---\ndata: 2026-01-01\n---\nx', 'x.md')).toThrow(/titulo/)
  })

  it('explode sem data, porque a ordem do blog depende dela', () => {
    expect(() => parsePost('---\ntitulo: x\n---\nx', 'x.md')).toThrow(/data/)
  })

  it('explode com data em formato errado, em vez de ordenar errado em silêncio', () => {
    expect(() => parsePost('---\ntitulo: x\ndata: ontem\n---\nx', 'x.md')).toThrow(/AAAA-MM-DD/)
  })
})
```

- [ ] **Step 4: Run and watch it fail**

Run: `npx vitest run plugins/__tests__/posts.test.ts`
Expected: FAIL — cannot find module `../posts`. If instead it reports
*zero test files*, Step 2 was not applied; go back and apply it.

- [ ] **Step 5: Write `plugins/posts.ts`**

```ts
/**
 * Pipeline de markdown em tempo de build.
 *
 * Lê `content/posts/*.md`, renderiza cada um pra HTML e expõe o resultado no
 * módulo virtual `virtual:posts`. O navegador recebe HTML pronto — nem o
 * parser de markdown nem o de YAML entram no bundle, porque o texto não muda
 * depois do build e mandar um parser junto seria pagar centenas de kilobytes
 * por nada.
 *
 * Toda validação aqui explode o build em vez de degradar. Um post sem título
 * ou com data mal escrita publica algo errado e silencioso; um build vermelho
 * custa trinta segundos.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { marked } from 'marked'
import { parse as parseYaml } from 'yaml'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:posts'
const RESOLVED_ID = '\0virtual:posts'
const POSTS_DIR = 'content/posts'
/** Velocidade de leitura pra prosa em português, em palavras por minuto. */
const WPM = 200
const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

export interface Post {
  slug: string
  titulo: string
  data: string
  resumo: string
  tags: string[]
  minutos: number
  html: string
  paragrafos: number
  rascunho: boolean
}

/**
 * Separa o bloco de frontmatter do corpo.
 *
 * A âncora é a *primeira* linha do arquivo: só um `---` na linha 1 abre
 * cabeçalho. Sem isso, uma régua horizontal no meio de um texto viraria
 * delimitador e comeria metade do post.
 */
export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const normalizado = raw.replace(/\r\n/g, '\n')
  if (!normalizado.startsWith('---\n')) return { frontmatter: '', body: normalizado }

  const fim = normalizado.indexOf('\n---', 3)
  if (fim === -1) return { frontmatter: '', body: normalizado }

  return {
    frontmatter: normalizado.slice(4, fim),
    body: normalizado.slice(fim + 4),
  }
}

export function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WPM))
}

/**
 * Só blocos de prosa. Título, cerca de código, régua e comentário HTML não são
 * parágrafo.
 *
 * Esse número vira a contagem de galhinhos no galho do post, então ele tem que
 * acompanhar como o texto *lê*, não quantas linhas em branco ele tem.
 */
export function countParagraphs(markdown: string): number {
  const blocos = markdown
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .filter(
      (b) =>
        !b.startsWith('#') &&
        !b.startsWith('```') &&
        !b.startsWith('---') &&
        !b.startsWith('<!--'),
    )
  return Math.max(1, blocos.length)
}

export function parsePost(raw: string, filename: string): Post {
  const { frontmatter, body } = splitFrontmatter(raw)
  const bruto = frontmatter ? (parseYaml(frontmatter) as Record<string, unknown> | null) : null
  // YAML de comentário puro parseia pra null; sem isso o acesso abaixo estoura.
  const data: Record<string, unknown> = bruto ?? {}

  if (!data['titulo']) throw new Error(`${filename}: frontmatter sem "titulo"`)
  if (!data['data']) throw new Error(`${filename}: frontmatter sem "data"`)

  const dataStr = String(data['data'])
  if (!DATA_VALIDA.test(dataStr)) {
    throw new Error(`${filename}: "data" precisa ser AAAA-MM-DD, veio "${dataStr}"`)
  }

  return {
    slug: slugFromFilename(filename),
    titulo: String(data['titulo']),
    data: dataStr,
    resumo: String(data['resumo'] ?? ''),
    tags: Array.isArray(data['tags']) ? data['tags'].map(String) : [],
    minutos: readingMinutes(body),
    html: marked.parse(body, { async: false }),
    paragrafos: countParagraphs(body),
    rascunho: data['rascunho'] === true,
  }
}

export function postsPlugin(): Plugin {
  let isProduction = false
  let projectRoot = process.cwd()

  async function loadAll(): Promise<Post[]> {
    const dir = join(projectRoot, POSTS_DIR)
    let files: string[]
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith('.md'))
    } catch {
      return []
    }
    const posts = await Promise.all(
      files.map(async (f) => parsePost(await readFile(join(dir, f), 'utf8'), f)),
    )
    return posts
      .filter((p) => !isProduction || !p.rascunho)
      .sort((a, b) => b.data.localeCompare(a.data))
  }

  return {
    name: 'posts',
    configResolved(config) {
      projectRoot = config.root
      isProduction = config.command === 'build'
    },
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : null),
    async load(id) {
      if (id !== RESOLVED_ID) return null
      return `export const posts = ${JSON.stringify(await loadAll())};`
    },
    configureServer(server) {
      // Editar um post recarrega o navegador sem reiniciar o Vite.
      server.watcher.add(join(projectRoot, POSTS_DIR))
      server.watcher.on('all', (_e, file) => {
        if (!file.endsWith('.md')) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}
```

If `marked.parse(body, { async: false })` is a type error under this version
of `marked`, the overload did not narrow — write
`marked.parse(body, { async: false }) as string` rather than making the
function `async`; the plugin's `load` is already async but `parsePost` is used
synchronously by every test.

- [ ] **Step 6: Run and watch it pass**

Run: `npx vitest run plugins/__tests__/posts.test.ts`
Expected: PASS, 18 tests, 1 file.

- [ ] **Step 7: Declare the virtual module in `src/posts.d.ts`**

```ts
declare module 'virtual:posts' {
  export interface Post {
    slug: string
    titulo: string
    data: string
    resumo: string
    tags: string[]
    minutos: number
    html: string
    paragrafos: number
    rascunho: boolean
  }
  /** Mais novo primeiro. Rascunho só aparece em dev. */
  export const posts: Post[]
}
```

- [ ] **Step 8: Register the plugin in `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import { postsPlugin } from './plugins/posts'

// GitHub Pages serves the site from /<repo>/, local dev serves from root.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/portfolio/' : '/',
  plugins: [postsPlugin()],
  build: { target: 'es2022' },
})
```

- [ ] **Step 9: Write the first post's scaffold**

Create `content/posts/2026-08-22-como-cheguei-aqui.md`. The prose here is
scaffold, not content: Nicholas replaces every marked paragraph with his own.
It exists so the world in Task 9 has real text to be driven by, and so the
scroll beats can be verified in a browser before he sits down to write.

Six paragraphs, because Task 9's world places one mannequin per paragraph and
six is where that yard stops looking empty and starts looking watched.

```markdown
---
titulo: como cheguei aqui
data: 2026-08-22
resumo: eu queria fazer o que o jogo fazia.
tags: [carreira]
---

<!--
  ANDAIME. cada parágrafo abaixo é pra ser reescrito por inteiro.
  o que precisa continuar de pé:
  - seis parágrafos, porque o mundo desse post põe um manequim por parágrafo
  - o slug `como-cheguei-aqui`, porque `content/worlds/como-cheguei-aqui.ts`
    é encontrado por ele. renomear o post sem renomear o mundo faz o post
    cair no mundo genérico, calado.
  apagar este comentário quando terminar.
-->

o primeiro computador da casa não era meu e eu passava mais tempo nele do que
todo mundo junto.

o que me pegou não foi jogar. foi a desconfiança de que aquilo ali tinha sido
feito por alguém, e que dava pra chegar do outro lado.

achei que programar ia ser parecido com jogar. mexer numa coisa, ela responder,
mexer de novo.

não é parecido. é a mesma coisa, só que o mapa não vem pronto.

levei tempo pra entender que era isso que eu queria fazer todo dia.

e continuo abrindo o editor pelo mesmo motivo que abria o jogo.
```

- [ ] **Step 10: Verify the virtual module in the browser**

Run `npm run dev`, open `/`, and in the console:

```js
(await import('virtual:posts')).posts[0]
```

Expected: `slug: 'como-cheguei-aqui'`, `titulo: 'como cheguei aqui'`,
`data: '2026-08-22'`, `paragrafos: 6`, `minutos: 1`, `rascunho: false`,
`html` starting with an HTML comment followed by `<p>`.

- [ ] **Step 11: Verify the build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean, 123 tests, build succeeds.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: build-time markdown pipeline behind virtual:posts"
```

---

### Task 5: camera flight

**Files:**
- Modify: `src/core/CameraRig.ts`, `src/core/__tests__/CameraRig.test.ts`

**Interfaces:**
- Consumes: `BranchRecord` from `src/world/BranchSystem.ts`.
- Produces:
  ```ts
  export interface Enquadramento { focus: Vector3; halfWidth: number; halfHeight: number }
  export function computeFlight(de: Enquadramento, para: Enquadramento, t: number): Enquadramento
  export function shortestAngle(de: number, para: number): number
  // methods on CameraRig:
  flyTo(focus: Vector3, halfWidth: number, halfHeight: number, seconds: number): void
  flyAlongBranch(branch: BranchRecord, seconds: number): void
  get flying(): boolean
  ```

Navigation moves the camera, not the page. `flyAlongBranch` frames one branch
from its side — which is what "diving into a post" has to mean, since looking
down a branch's own axis frames a dot.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/__tests__/CameraRig.test.ts`:

```ts
import { Vector3 } from 'three'
import { computeFlight, scrollDolly, shortestAngle, type Enquadramento } from '../CameraRig'

const de: Enquadramento = { focus: new Vector3(0, 7, 0), halfWidth: 8, halfHeight: 10 }
const para: Enquadramento = { focus: new Vector3(4, 12, -2), halfWidth: 2, halfHeight: 3 }

describe('computeFlight', () => {
  it('em t=0 é exatamente a origem', () => {
    const q = computeFlight(de, para, 0)
    expect(q.focus.toArray()).toEqual([0, 7, 0])
    expect(q.halfWidth).toBe(8)
    expect(q.halfHeight).toBe(10)
  })

  it('em t=1 é exatamente o destino', () => {
    const q = computeFlight(de, para, 1)
    expect(q.focus.toArray()).toEqual([4, 12, -2])
    expect(q.halfWidth).toBe(2)
    expect(q.halfHeight).toBe(3)
  })

  it('nunca sai de dentro dos dois extremos', () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const q = computeFlight(de, para, t)
      expect(q.focus.x).toBeGreaterThanOrEqual(0)
      expect(q.focus.x).toBeLessThanOrEqual(4)
      expect(q.focus.z).toBeLessThanOrEqual(0)
      expect(q.focus.z).toBeGreaterThanOrEqual(-2)
      expect(q.halfWidth).toBeLessThanOrEqual(8)
      expect(q.halfWidth).toBeGreaterThanOrEqual(2)
    }
  })

  it('não devolve o mesmo objeto de entrada, que seria alias silencioso', () => {
    const q = computeFlight(de, para, 0)
    expect(q.focus).not.toBe(de.focus)
  })
})

describe('shortestAngle', () => {
  it('vai pelo lado curto ao cruzar π', () => {
    expect(shortestAngle(3.0, -3.0)).toBeCloseTo(0.2831853, 5)
  })
  it('é zero pra ângulos iguais', () => {
    expect(shortestAngle(1.2, 1.2)).toBe(0)
  })
  it('nunca passa de meia volta', () => {
    for (let a = -10; a < 10; a += 0.37) {
      for (let b = -10; b < 10; b += 0.53) {
        expect(Math.abs(shortestAngle(a, b))).toBeLessThanOrEqual(Math.PI + 1e-9)
      }
    }
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/core/__tests__/CameraRig.test.ts`
Expected: FAIL — `computeFlight` and `shortestAngle` are not exported.

- [ ] **Step 3: Add the pure helpers to `src/core/CameraRig.ts`**

```ts
export interface Enquadramento {
  focus: Vector3
  halfWidth: number
  halfHeight: number
}

/**
 * Interpolação linear entre dois enquadramentos.
 *
 * Linear de propósito: a suavização é aplicada no `t` antes de chamar isto, o
 * que deixa a curva ser escolhida por quem chama e deixa esta função ter um
 * teste que diz uma coisa só.
 */
export function computeFlight(de: Enquadramento, para: Enquadramento, t: number): Enquadramento {
  const k = clamp01(t)
  return {
    focus: de.focus.clone().lerp(para.focus, k),
    halfWidth: de.halfWidth + (para.halfWidth - de.halfWidth) * k,
    halfHeight: de.halfHeight + (para.halfHeight - de.halfHeight) * k,
  }
}

/**
 * Menor diferença angular, dentro de ±π.
 *
 * Sem isso, um voo de 170° pra -170° gira 340° pelo caminho longo — a câmera
 * dá quase uma volta inteira em torno da árvore pra chegar num galho que
 * estava logo ali.
 */
export function shortestAngle(de: number, para: number): number {
  const volta = Math.PI * 2
  let d = (para - de) % volta
  if (d > Math.PI) d -= volta
  if (d < -Math.PI) d += volta
  return d
}
```

`Vector3.lerp` needs no import change — `Vector3` is already imported.

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run src/core/__tests__/CameraRig.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Add the flight state to the class**

Fields, next to `azimuth` / `polar`:

```ts
  /**
   * Azimute de repouso. O paralaxe do ponteiro monta em cima disto, então
   * mudar a base gira o mundo inteiro sem mexer em como ele responde à mão.
   */
  private baseAzimuth = 0
  private baseAzimuthDe = 0
  private baseAzimuthPara = 0
  private flight: { de: Enquadramento; para: Enquadramento; t: number; dur: number } | null = null
```

Methods, after `refit()`:

```ts
  /** Enquadramento atual, copiado — quem recebe pode guardar sem alias. */
  private get enquadramento(): Enquadramento {
    return {
      focus: this.focus.clone(),
      halfWidth: this.halfWidth,
      halfHeight: this.halfHeight,
    }
  }

  private partir(para: Enquadramento, azimute: number, seconds: number): void {
    const dur = this.quality.reducedMotion ? 0 : seconds

    this.baseAzimuthDe = this.baseAzimuth
    this.baseAzimuthPara = azimute

    if (dur <= 0) {
      // Movimento reduzido não ganha uma versão lenta do voo: ganha o destino.
      this.focus.copy(para.focus)
      this.halfWidth = para.halfWidth
      this.halfHeight = para.halfHeight
      this.baseAzimuth = azimute
      this.flight = null
      this.refit()
      return
    }

    this.flight = { de: this.enquadramento, para, t: 0, dur }
  }

  flyTo(focus: Vector3, halfWidth: number, halfHeight: number, seconds: number): void {
    this.partir({ focus: focus.clone(), halfWidth, halfHeight }, 0, seconds)
  }

  /**
   * Emoldura um galho de lado.
   *
   * O ponto de mira é o meio do galho e a meia-extensão é metade do
   * comprimento dele, com uma folga pra ele não encostar na borda. O azimute
   * de repouso fica perpendicular à direção do galho — olhar na direção do
   * eixo dele enquadraria um ponto.
   */
  flyAlongBranch(branch: BranchRecord, seconds: number): void {
    const meio = branch.start.clone().add(branch.tip).multiplyScalar(0.5)
    const meia = Math.max(branch.length * 0.62, 1.4)
    const azimute = Math.atan2(branch.along.x, branch.along.z) + Math.PI / 2
    this.partir({ focus: meio, halfWidth: meia, halfHeight: meia }, azimute, seconds)
  }

  get flying(): boolean {
    return this.flight !== null
  }
```

Add the type import at the top:

```ts
import type { BranchRecord } from '../world/BranchSystem'
```

- [ ] **Step 6: Advance the flight in `update()`**

At the very top of `update(dt, elapsed)`, before the reduced-motion read:

```ts
    if (this.flight) {
      this.flight.t = Math.min(this.flight.t + dt / this.flight.dur, 1)
      const k = easeInOutCubic(this.flight.t)
      const q = computeFlight(this.flight.de, this.flight.para, k)
      this.focus.copy(q.focus)
      this.halfWidth = q.halfWidth
      this.halfHeight = q.halfHeight
      this.baseAzimuth =
        this.baseAzimuthDe + shortestAngle(this.baseAzimuthDe, this.baseAzimuthPara) * k
      // refit por frame: a distância sai do fov e do aspecto, e as
      // meia-extensões estão mudando o tempo todo durante o voo.
      this.refit()
      if (this.flight.t >= 1) this.flight = null
    }
```

and fold the base into the final azimuth:

```ts
    const az = this.baseAzimuth + this.azimuth + driftAz
```

- [ ] **Step 7: Browser-verify**

Run `npm run dev`, open `/`, and in the console:

```js
__world.rig.flyAlongBranch(__world.branches.branches[40], 1.2)
```

Expected: the camera eases in and frames that one branch side-on over about a
second; `__world.rig.flying` reads `true` during and `false` after. Then:

```js
const b = __world.branches
__world.rig.flyTo(new (await import('three')).Vector3(0, b.centreY, 0), b.halfWidth, b.halfHeight, 1.2)
```

Expected: it eases back to the whole tree, same framing as on load. Resize the
window mid-flight: no jump, no crop.

- [ ] **Step 8: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A
git commit -m "feat: camera flights, including framing a single branch"
```

---

### Task 6: the blog is the tree from inside

**Files:**
- Create: `src/world/BranchLabels.ts`, `src/world/__tests__/BranchLabels.test.ts`,
  `src/ui/pages/BlogPage.ts`
- Modify: `src/main.ts`, `src/styles/ui.css`

**Interfaces:**
- Consumes: `posts` from `virtual:posts`, `BranchRecord[]`,
  `ScanReveal.setLitBranch`, `CameraRig.flyTo`, `Page` from `PageHost`.
- Produces:
  ```ts
  export interface PostBranch { slug: string; titulo: string; branch: BranchRecord }
  export function assignBranches(
    posts: { slug: string; titulo: string; data: string }[],
    branches: BranchRecord[],
  ): PostBranch[]
  export class BranchLabels {
    readonly group: Group
    constructor(quality: Quality)
    setPosts(assignments: PostBranch[]): void
    setVisible(v: boolean): void
    setHighlight(slug: string | null): void
    update(dt: number, elapsed: number, camera: PerspectiveCamera): void
    hitTest(raycaster: Raycaster): string | null
    dispose(): void
  }
  export class BlogPage implements Page
  ```

There is no post list. The tree is the index: the camera flies into the canopy
and each post hangs on its own branch with a floating label.

- [ ] **Step 1: Write the failing `assignBranches` tests**

Create `src/world/__tests__/BranchLabels.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { generateBranches, type BranchRecord } from '../BranchSystem'
import { assignBranches } from '../BranchLabels'

const arvore = generateBranches({ origin: new Vector3(0, 6.5, 0), depth: 6 })

/** Mais novo primeiro, que é como `virtual:posts` entrega. */
const posts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    slug: `p${i}`,
    titulo: `post ${i}`,
    data: `2026-01-${String(n - i).padStart(2, '0')}`,
  }))

describe('assignBranches', () => {
  it('dá um galho pra cada post', () => {
    expect(assignBranches(posts(5), arvore.branches)).toHaveLength(5)
  })

  it('devolve na ordem que recebeu', () => {
    expect(assignBranches(posts(4), arvore.branches).map((a) => a.slug)).toEqual([
      'p0', 'p1', 'p2', 'p3',
    ])
  })

  it('nunca põe dois posts no mesmo galho', () => {
    const ids = assignBranches(posts(12), arvore.branches).map((a) => a.branch.id)
    expect(new Set(ids).size).toBe(12)
  })

  it('é determinística, pra que um post não troque de galho entre visitas', () => {
    const a = assignBranches(posts(6), arvore.branches).map((x) => x.branch.id)
    const b = assignBranches(posts(6), arvore.branches).map((x) => x.branch.id)
    expect(a).toEqual(b)
  })

  it('um post mantém o galho quando outro é publicado depois dele', () => {
    const antigos = [
      { slug: 'b', titulo: 'b', data: '2026-02-01' },
      { slug: 'a', titulo: 'a', data: '2026-01-01' },
    ]
    const comNovo = [{ slug: 'c', titulo: 'c', data: '2026-03-01' }, ...antigos]

    const antes = new Map(assignBranches(antigos, arvore.branches).map((x) => [x.slug, x.branch.id]))
    const depois = new Map(assignBranches(comNovo, arvore.branches).map((x) => [x.slug, x.branch.id]))

    expect(depois.get('a')).toBe(antes.get('a'))
    expect(depois.get('b')).toBe(antes.get('b'))
    expect(depois.get('c')).not.toBe(antes.get('a'))
  })

  it('o mais antigo fica embaixo e o mais novo em cima, como galho cresce', () => {
    const escolhidos = assignBranches(posts(5), arvore.branches)
    const maisNovo = escolhidos[0]!.branch.tip.y
    const maisAntigo = escolhidos[4]!.branch.tip.y
    expect(maisNovo).toBeGreaterThan(maisAntigo)
  })

  it('prefere galho de meia profundidade, que é onde um rótulo cabe', () => {
    for (const a of assignBranches(posts(8), arvore.branches)) {
      expect(a.branch.depth).toBeGreaterThanOrEqual(2)
      expect(a.branch.depth).toBeLessThanOrEqual(4)
    }
  })

  it('espaça os galhos escolhidos', () => {
    const escolhidos = assignBranches(posts(6), arvore.branches)
    for (let i = 0; i < escolhidos.length; i++) {
      for (let j = i + 1; j < escolhidos.length; j++) {
        expect(
          escolhidos[i]!.branch.tip.distanceTo(escolhidos[j]!.branch.tip),
        ).toBeGreaterThan(0.9)
      }
    }
  })

  it('aguenta mais posts do que galhos ideais sem repetir nem cair', () => {
    const muitos = assignBranches(posts(400), arvore.branches)
    expect(new Set(muitos.map((a) => a.branch.id)).size).toBe(400)
  })

  it('explode quando a árvore não tem galho pra todo mundo', () => {
    const poucos: BranchRecord[] = arvore.branches.slice(0, 3)
    expect(() => assignBranches(posts(10), poucos)).toThrow(/galhos/)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(assignBranches([], arvore.branches)).toEqual([])
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/world/__tests__/BranchLabels.test.ts`
Expected: FAIL — cannot find module `../BranchLabels`.

- [ ] **Step 3: Implement `assignBranches` in `src/world/BranchLabels.ts`**

```ts
/** Profundidade em que um galho é grosso o bastante pra carregar um rótulo. */
const PROFUNDIDADE_MIN = 2
const PROFUNDIDADE_MAX = 4
/** Distância mínima entre pontas escolhidas, em unidades de mundo. */
const SEPARACAO = 1.6

export interface PostBranch {
  slug: string
  titulo: string
  branch: BranchRecord
}

/**
 * Casa cada post com um galho de verdade.
 *
 * Determinística de ponta a ponta: nenhuma aleatoriedade, e a ordem de entrada
 * manda. Como `posts` chega mais novo primeiro e um post novo entra na frente,
 * publicar *não* embaralha os galhos de quem já estava lá — o post de ontem
 * continua no galho de ontem, que é o que faz a árvore ser um lugar em vez de
 * um sorteio.
 *
 * Três passadas, cada uma afrouxando uma exigência: primeiro galho ideal bem
 * espaçado, depois galho ideal em qualquer lugar, depois qualquer galho. Se
 * ainda faltar, explode — um post sem galho não tem como aparecer no blog, e
 * sumir calado é pior que não construir.
 */
export function assignBranches(
  posts: { slug: string; titulo: string; data: string }[],
  branches: BranchRecord[],
): PostBranch[] {
  if (posts.length === 0) return []

  // Baixo pra cima. O post mais antigo é atribuído primeiro e fica no galho
  // mais baixo; o mais novo sobe. É como galho cresce, e é o que faz a copa
  // ser uma linha do tempo em vez de uma prateleira.
  const porAltura = (a: BranchRecord, b: BranchRecord): number => a.tip.y - b.tip.y || a.id - b.id
  const ideais = branches
    .filter((b) => b.depth >= PROFUNDIDADE_MIN && b.depth <= PROFUNDIDADE_MAX)
    .sort(porAltura)
  const resto = branches
    .filter((b) => b.depth < PROFUNDIDADE_MIN || b.depth > PROFUNDIDADE_MAX)
    .sort(porAltura)

  const usados = new Set<number>()
  const escolhidos: BranchRecord[] = []

  function pegar(pool: BranchRecord[], separacao: number): BranchRecord | null {
    for (const b of pool) {
      if (usados.has(b.id)) continue
      if (separacao > 0 && escolhidos.some((c) => c.tip.distanceTo(b.tip) < separacao)) continue
      usados.add(b.id)
      escolhidos.push(b)
      return b
    }
    return null
  }

  // A atribuição corre em ordem de publicação, não na ordem em que a lista
  // chegou. `virtual:posts` entrega mais novo primeiro, então atribuir na
  // ordem recebida faria cada post novo empurrar todo mundo pro galho do
  // vizinho — a árvore inteira se reorganizaria a cada publicação. Correndo
  // do mais antigo pro mais novo, quem já tem galho fica com ele pra sempre.
  const publicacao = [...posts].sort(
    (a, b) => a.data.localeCompare(b.data) || a.slug.localeCompare(b.slug),
  )

  const porSlug = new Map<string, BranchRecord>()
  for (const post of publicacao) {
    const branch = pegar(ideais, SEPARACAO) ?? pegar(ideais, 0) ?? pegar(resto, 0)
    if (!branch) {
      throw new Error(
        `assignBranches: ${posts.length} posts e só ${branches.length} galhos na árvore`,
      )
    }
    porSlug.set(post.slug, branch)
  }

  return posts.map((post) => ({
    slug: post.slug,
    titulo: post.titulo,
    branch: porSlug.get(post.slug)!,
  }))
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run src/world/__tests__/BranchLabels.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Implement `BranchLabels` in the same file**

Labels are drawn as `CanvasTexture` sprites, not DOM. A DOM label over a 3D
scene has to be repositioned every frame from a projected point, which both
costs a layout read per label per frame and always lags the camera by one
frame. A billboarded sprite is simply *in* the world.

```ts
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  type PerspectiveCamera,
  type Raycaster,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import type { Quality } from '../core/Quality'
import { damp } from '../util/tween'
import type { BranchRecord } from './BranchSystem'

/** Altura do rótulo em unidades de mundo. A largura sai do texto. */
const ALTURA = 0.42
/** Quanto o rótulo flutua acima da ponta do galho. */
const OFFSET = 0.55
const COR_REPOUSO = '#9fbfae'
const COR_ACESA = '#d9ffe9'

interface Rotulo {
  slug: string
  sprite: Sprite
  material: SpriteMaterial
  texture: CanvasTexture
  branchId: number
  ancora: Vector3
  alvo: number
  atual: number
}
```

`setPosts` builds one sprite per post: render the title at `2 * dpr` scale
onto a canvas sized to `measureText`, in `--font-sans` at the same weight the
page uses, white on transparent; tint comes from `SpriteMaterial.color` so a
highlight does not require re-rasterising. Wait for `document.fonts.ready`
before measuring — measuring before the webfont resolves gives fallback
metrics and a sprite that is the wrong width for the rest of the session.

A thin `LineSegments` in the same group joins each branch tip to its label
anchor, one two-vertex segment per label, additive, so the label reads as
attached rather than floating nearby.

`update` billboards each sprite by copying the camera quaternion is not
needed — `Sprite` already faces the camera. What `update` does is damp
`atual` toward `alvo` (0 at rest, 1 highlighted), lerp `material.color`
between `COR_REPOUSO` and `COR_ACESA`, and bob each anchor by
`Math.sin(elapsed * 0.6 + i) * 0.04` so the canopy is never perfectly still.

`setHighlight(slug)` sets `alvo` and is the *only* thing that calls
`ScanReveal.setLitBranch` — via the return of `branchIdFor(slug)`, read by
`main.ts`. Keeping the scan call outside this class keeps `BranchLabels` from
needing to know that a scan exists.

`hitTest(raycaster)` intersects the sprite array and returns the nearest
slug, or `null`.

`dispose()` frees every texture, material, geometry and sprite.

- [ ] **Step 6: Implement `src/ui/pages/BlogPage.ts`**

Minimal DOM, all lowercase:

- `<h1>blog</h1>`
- one line: `cada texto é um galho. escolha um.`
- a fallback list of post links — `<a href="/blog/:slug">` with title, date and
  reading time — visually subdued but fully keyboard navigable and marked
  `data-reveal="linha"`. The world is the primary interface; it must not be the
  only one. This list is what a keyboard user, a screen reader and a crawler
  actually use.

On `mount`: `rig.flyTo` to the canopy framing
(`focus (0, canopyY, 0)`, half-extents about 55% of the tree's, 1.1s) and
`labels.setVisible(true)`.
On `unmount`: `labels.setVisible(false)` and clear the highlight.

The page receives `rig` and `labels` through its constructor rather than
reaching for a global.

- [ ] **Step 7: Create the labels and assign the branches, in `src/main.ts`**

This is where posts meet the tree, and it happens once at boot — not per
route. The assignment must be identical on `/blog` and on a cold load of
`/blog/:slug`, or the post's own branch would move depending on how you
arrived at it.

```ts
import { posts } from 'virtual:posts'
import { BranchLabels, assignBranches } from './world/BranchLabels'

const labels = new BranchLabels(quality)
const atribuicoes = assignBranches(posts, branches.branches)
labels.setPosts(atribuicoes)
labels.setVisible(false)
stage.scene.add(labels.group)
```

Add `labels.update(dt, elapsed, stage.camera)` to the existing world tick, and
`labels.dispose()` is not called — the labels live as long as the tree does.

- [ ] **Step 8: Hover and click in the world, in `src/main.ts`**

Add a loop tick that raycasts labels only while the blog route is active,
sets `document.body.style.cursor`, calls `labels.setHighlight(slug)` and
`scan.setLitBranch(labels.branchIdFor(slug))`. A click on a hit navigates to
`buildPath('post', { slug })`.

Reuse the existing `raycaster` and `ndc` already in `main.ts` rather than
allocating a second pair — and gate the whole tick on
`router.current.name === 'blog'`, so the post page's own raycasting (Task 8)
and this one never both claim the cursor.

- [ ] **Step 9: Route `/blog` in `src/main.ts`**

Replace the Milestone A stub that rewrites everything to home:

```ts
const router = new Router((match) => {
  switch (match.name) {
    case 'home':
      void host.show(new HomePage())
      return
    case 'blog':
      void host.show(new BlogPage(rig, labels, posts))
      return
    default:
      // Post e 404 chegam na Task 8. Até lá, qualquer outra rota volta pra
      // casa em vez de deixar a tela em branco.
      router.navigate('/', true)
  }
})
```

- [ ] **Step 10: Browser-verify**

Open `/blog`. Expected: the camera flies into the canopy; one label per post
(one, for now); hovering a label lights exactly that branch and no other;
clicking it changes the URL; the fallback list is reachable by Tab with a
visible focus ring and its link works; the tree never reloads. Zero console
errors.

- [ ] **Step 11: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A
git commit -m "feat: the blog is the tree seen from inside"
```

---

### Task 7: post worlds — the contract, the default, the escape hatch

**Files:**
- Create: `src/world/PostWorld.ts`, `src/world/__tests__/PostWorld.test.ts`,
  `src/fx/shaders/twig.ts`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `BranchRecord`, `Quality`, `CameraRig`, `Post` from `virtual:posts`.
- Produces:
  ```ts
  export interface PostWorldContext {
    scene: Scene
    camera: PerspectiveCamera
    branch: BranchRecord
    post: Post
    quality: Quality
    rig: CameraRig
    /** Onde um mundo pode pendurar overlay em DOM, se precisar de um. */
    overlay: HTMLElement
  }
  export interface PostWorldModule {
    build(ctx: PostWorldContext): void
    update(dt: number, elapsed: number, progress: number): void
    dispose(): void
  }
  export class GeneratedPostWorld implements PostWorldModule
  export function loadPostWorld(post: Post): Promise<PostWorldModule>
  export function orphanWorlds(slugs: string[]): string[]
  export function twigLit(progress: number, total: number): number
  export function hueDaTag(tag: string | undefined): number
  export function beat(progress: number, de: number, ate: number): number
  ```

The default world is derived entirely from the post: `slug` seeds the growth,
`paragrafos` sets the twig count, the first tag picks a hue inside a bounded
band. Scrolling advances `progress`, and twigs light in order — one per
paragraph — so reading the text is what makes its branch grow.

Generated is the default so that writing stays cheap: a post must never
require a hand-built scene before it can be published. Bespoke exists so the
site can still surprise when a subject deserves it.

- [ ] **Step 1: Write the failing tests**

Create `src/world/__tests__/PostWorld.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { beat, hueDaTag, twigLit } from '../PostWorld'

describe('twigLit', () => {
  it('no topo do texto nada está aceso', () => {
    // O shader acende quando aTwigIndex <= uLit, e o primeiro galhinho é o
    // índice 0 — então "nada aceso" tem que ser um valor negativo, não zero.
    expect(twigLit(0, 6)).toBe(-1)
  })

  it('no fim do texto o último galhinho está aceso e nem um a mais', () => {
    expect(twigLit(1, 6)).toBe(5)
  })

  it('no meio acende metade', () => {
    expect(twigLit(0.5, 6)).toBe(2)
  })

  it('cresce sem voltar atrás', () => {
    let anterior = -Infinity
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = twigLit(t, 9)
      expect(v).toBeGreaterThanOrEqual(anterior)
      anterior = v
    }
  })

  it('trava fora de 0..1', () => {
    expect(twigLit(-2, 6)).toBe(-1)
    expect(twigLit(4, 6)).toBe(5)
  })

  it('um post sem galhinho nenhum não acende nada', () => {
    expect(twigLit(1, 0)).toBe(-1)
  })
})

describe('beat', () => {
  it('é zero antes da janela e um depois dela', () => {
    expect(beat(0.1, 0.3, 0.6)).toBe(0)
    expect(beat(0.9, 0.3, 0.6)).toBe(1)
  })

  it('é meio no meio da janela', () => {
    expect(beat(0.45, 0.3, 0.6)).toBeCloseTo(0.5, 6)
  })

  it('uma janela de largura zero vira um degrau, sem dividir por zero', () => {
    expect(beat(0.29, 0.3, 0.3)).toBe(0)
    expect(beat(0.3, 0.3, 0.3)).toBe(1)
    expect(Number.isFinite(beat(0.5, 0.3, 0.3))).toBe(true)
  })

  it('uma janela invertida não devolve NaN nem negativo', () => {
    const v = beat(0.5, 0.8, 0.2)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
  })
})

describe('hueDaTag', () => {
  it('sem tag é o verde da casa, exatamente', () => {
    expect(hueDaTag(undefined)).toBe(150)
  })

  it('a mesma tag dá sempre o mesmo tom', () => {
    expect(hueDaTag('carreira')).toBe(hueDaTag('carreira'))
  })

  it('tags diferentes tendem a dar tons diferentes', () => {
    const tons = new Set(['meta', 'carreira', 'código', 'roça', 'cinema'].map(hueDaTag))
    expect(tons.size).toBeGreaterThanOrEqual(4)
  })

  it('nunca sai da vizinhança do verde — o contrato do mundo exige', () => {
    for (const tag of ['a', 'bb', 'ccc', 'zzzzzz', 'ção', '']) {
      expect(hueDaTag(tag)).toBeGreaterThanOrEqual(80)
      expect(hueDaTag(tag)).toBeLessThanOrEqual(220)
    }
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/world/__tests__/PostWorld.test.ts`
Expected: FAIL — cannot find module `../PostWorld`.

- [ ] **Step 3: Write the pure parts of `src/world/PostWorld.ts`**

```ts
/** Tom base da casa, em graus. Todo mundo sai daqui e volta pra cá. */
const VERDE = 150
/** Deriva máxima permitida pelo contrato do mundo. */
const DERIVA = 70

/**
 * Quantos galhinhos estão acesos, como o shader espera ler.
 *
 * O gate é `aTwigIndex <= uLit` e o primeiro galhinho é o índice 0, então
 * "nenhum aceso" é -1 e não 0. A parte fracionária serve pro galhinho da
 * frente crescer pela metade, pra que o avanço seja contínuo em vez de
 * degrau a degrau.
 */
export function twigLit(progress: number, total: number): number {
  if (total <= 0) return -1
  return clamp01(progress) * total - 1
}

/**
 * Tom derivado da primeira tag do post.
 *
 * A faixa é limitada de propósito: o contrato diz que o leitor entra no verde
 * e sai no verde, e uma tag qualquer não pode levar um post pro roxo. Cada
 * assunto ganha um verde próprio, não uma paleta própria.
 */
/**
 * Uma janela do progresso, normalizada de 0 a 1.
 *
 * É o único jeito que um mundo tem de dizer "isto acontece entre aqui e ali".
 * Toda batida de todo mundo — gerado ou à mão — sai daqui, e é por isso que
 * nenhuma delas precisa de relógio próprio: o relógio é a leitura.
 */
export function beat(progress: number, de: number, ate: number): number {
  if (ate <= de) return progress >= de ? 1 : 0
  return clamp01((progress - de) / (ate - de))
}

export function hueDaTag(tag: string | undefined): number {
  if (!tag) return VERDE
  let h = 2166136261
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return VERDE - DERIVA + (Math.abs(h) % (DERIVA * 2 + 1))
}
```

Import `clamp01` from `../util/tween`.

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run src/world/__tests__/PostWorld.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Write `src/fx/shaders/twig.ts`**

A deliberate copy of the `branch.ts` pair with one gate added. The tree's
shader runs over roughly forty thousand vertices every frame and is the single
hottest program in the scene; parameterising it so a handful of twigs can use
a second gating mode would put a branch in that inner loop for the rest of the
site's life. Two readable programs beat one clever one here.

`twigVertex` is `branchVertex` plus `attribute float aTwigIndex;` and
`varying float vTwigIndex;`.
`twigFragment` is `branchFragment` with `uLitBranch` removed and, after the
`lead < 0.0` discard, this gate:

```glsl
  // Um galhinho por parágrafo lido. O inteiro decide se ele existe; a fração
  // faz o da frente crescer, pra que a leitura empurre o galho em vez de
  // piscar mais um pedaço a cada parágrafo.
  float delta = uLit - vTwigIndex;
  if (delta < 0.0) discard;
  float grow = clamp(delta, 0.0, 1.0);
```

and `grow` multiplies the final `alpha` and the `crest` term.

- [ ] **Step 6: Implement `GeneratedPostWorld`**

`build(ctx)`:
- Seed `mulberry32(hash(ctx.post.slug))` from `src/util/rng`.
- Grow `ctx.post.paragrafos` twigs outward from `ctx.branch.tip`, fanned around
  `ctx.branch.along`, each 4 sub-segments long with the same wander the tree
  uses, and each carrying its index in `aTwigIndex` on every one of its
  vertices.
- One `LineSegments` with the `twig` material, `AdditiveBlending`,
  `depthWrite: false`, added to `ctx.scene`.
- `uRestColor` / `uEdgeColor` set from `hueDaTag(ctx.post.tags[0])` via
  `new Color().setHSL(hue / 360, 0.72, 0.6)`.

`update(dt, _elapsed, progress)`:
- `uLit` damped toward `twigLit(progress, paragrafos)` at lambda 6, so a fast
  scroll does not snap the growth. Under reduced motion, assigned directly.
- `uScanRadius` pinned at a value beyond the twigs' extent, since the
  distance gate is not what drives this world.

`dispose()`: remove from the scene, dispose geometry and material.

- [ ] **Step 7: Add the escape hatch and its orphan check**

```ts
/**
 * Um post pode trocar o mundo gerado inteiro por um à mão: basta
 * `content/worlds/<slug>.ts` exportando um `PostWorldModule` como default.
 *
 * A busca é pelo slug, e é aí que mora a única armadilha: renomear o post sem
 * renomear o arquivo faz o post cair no mundo genérico em silêncio. Por isso
 * `orphanWorlds` existe e `main.ts` grita em dev.
 */
const custom = import.meta.glob<{ default: PostWorldModule }>('/content/worlds/*.ts')

const PREFIXO = '/content/worlds/'

export async function loadPostWorld(post: Post): Promise<PostWorldModule> {
  const loader = custom[`${PREFIXO}${post.slug}.ts`]
  if (loader) return (await loader()).default
  return new GeneratedPostWorld()
}

/** Mundos à mão que não têm post correspondente. Quase sempre um rename. */
export function orphanWorlds(slugs: string[]): string[] {
  const existem = new Set(slugs)
  return Object.keys(custom)
    .map((k) => k.slice(PREFIXO.length).replace(/\.ts$/, ''))
    .filter((s) => !existem.has(s))
}
```

In `src/main.ts`, near the existing `console.info`:

```ts
if (import.meta.env.DEV) {
  const orfaos = orphanWorlds(posts.map((p) => p.slug))
  if (orfaos.length) {
    console.warn(
      `[portfolio] mundo sem post: ${orfaos.join(', ')} — renomeou o post e esqueceu o mundo?`,
    )
  }
}
```

- [ ] **Step 8: Add `content` to `tsconfig.json` include**

```json
  "include": ["src", "plugins", "content", "vite.config.ts", "vitest.config.ts"]
```

Without this, `content/worlds/*.ts` is loaded by Vite but never typechecked,
and Task 9 would ship a file that `npm run build` never looks at.

- [ ] **Step 9: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A
git commit -m "feat: post worlds — generated by default, bespoke by escape hatch"
```

---

### Task 8: the post page

**Files:**
- Create: `src/ui/pages/PostPage.ts`, `src/ui/pages/NotFoundPage.ts`,
  `src/ui/__tests__/PostPage.test.ts`, `src/styles/prose.css`
- Modify: `src/main.ts`, `src/styles/motion.css`,
  `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `Post`, `PostBranch`, `loadPostWorld`, `CameraRig.flyAlongBranch`,
  `BranchLabels.setVisible`.
- Produces:
  ```ts
  export function readingProgress(
    scrollY: number, topo: number, altura: number, viewport: number,
  ): number
  export class PostPage implements Page {
    constructor(
      post: Post, assignment: PostBranch, rig: CameraRig, labels: BranchLabels,
      scene: Scene, camera: PerspectiveCamera, quality: Quality,
    )
  }
  export class NotFoundPage implements Page {
    constructor(rig: CameraRig, branches: BranchData)
  }
  ```

- [ ] **Step 1: Write the failing `readingProgress` tests**

Create `src/ui/__tests__/PostPage.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readingProgress } from '../pages/PostPage'

// topo=200, altura=2000, viewport=800 → 1200px de rolagem útil, de 200 a 1400.
const p = (scrollY: number) => readingProgress(scrollY, 200, 2000, 800)

describe('readingProgress', () => {
  it('é zero antes do artigo começar a sair da tela', () => {
    expect(p(0)).toBe(0)
    expect(p(200)).toBe(0)
  })

  it('é um quando o fim do artigo encosta no fim da tela', () => {
    expect(p(1400)).toBe(1)
  })

  it('é meio no meio', () => {
    expect(p(800)).toBeCloseTo(0.5, 6)
  })

  it('trava nas pontas, porque rolagem elástica passa dos limites', () => {
    expect(p(-300)).toBe(0)
    expect(p(9000)).toBe(1)
  })

  it('um artigo que cabe na tela já nasce completo', () => {
    // Não há o que rolar, então não há o que revelar aos poucos. O CSS do
    // leitor dá folga embaixo justamente pra que este caso seja raro.
    expect(readingProgress(0, 100, 400, 800)).toBe(1)
  })

  it('nunca devolve NaN, nem com altura igual à viewport', () => {
    expect(Number.isFinite(readingProgress(0, 0, 800, 800))).toBe(true)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/ui/__tests__/PostPage.test.ts`
Expected: FAIL — cannot find module `../pages/PostPage`.

- [ ] **Step 3: Write `readingProgress` in `src/ui/pages/PostPage.ts`**

```ts
/**
 * Quanto do artigo já passou pelos olhos, de 0 a 1.
 *
 * Medido pelo artigo e não pelo documento: o rodapé e a folga de baixo não
 * são texto, e contá-los faria o mundo terminar de crescer antes da última
 * frase. É este número, e só ele, que move o mundo do post — ver o contrato,
 * item 5.
 */
export function readingProgress(
  scrollY: number,
  topo: number,
  altura: number,
  viewport: number,
): number {
  const curso = altura - viewport
  // Artigo que cabe na tela não tem curso. Devolver 0 deixaria o mundo pela
  // metade pra sempre; devolver 1 entrega ele inteiro, que é o certo quando
  // não sobrou nada pra revelar.
  if (curso <= 0) return 1
  return clamp01((scrollY - topo) / curso)
}
```

Import `clamp01` from `../../util/tween`.

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run src/ui/__tests__/PostPage.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Implement `PostPage`**

Constructor: `(post: Post, assignment: PostBranch, rig: CameraRig, labels: BranchLabels, scene: Scene, camera: PerspectiveCamera, quality: Quality)`.

`mount(root)` builds, all lowercase:

```html
<div class="leitura-progresso" aria-hidden="true"></div>
<article class="leitura material" data-reveal>
  <a class="voltar" href="/blog">← blog</a>
  <p class="carimbo"><time datetime="AAAA-MM-DD">22 de agosto de 2026</time> · 3 min</p>
  <h1>como cheguei aqui</h1>
  <div class="prosa-post"><!-- post.html --></div>
</article>
```

The date is formatted with
`new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })`
applied to `new Date(`${post.data}T12:00:00`)` — midday, so no timezone can
roll the date back a day. `Intl` gives lowercase month names in pt-BR already.

`post.html` is trusted: it is compiled at build time from a file in this
repository, by us, and never from user input. It goes in with `innerHTML`
because that is what it is — finished markup.

`mount` also:
- stores `document.title` and the meta description, sets them to
  `post.titulo` and `post.resumo`, and restores both in `unmount`
- calls `rig.flyAlongBranch(this.assignment.branch, 1.3)`
- calls `labels.setVisible(false)` — the canopy's labels would sit on top of
  the world the post is building
- `await loadPostWorld(post)` then `world.build(ctx)`, with
  `overlay: root` in the context

`update(dt)` reads the article's `offsetTop` and `offsetHeight` from a cache
invalidated on resize, computes `readingProgress`, and calls
`world.update(dt, elapsed, progress)`.

`unmount()` calls `world.dispose()`, restores the title and description, and
calls `labels.setVisible(true)` only if the next route is the blog — simpler
and safer: always restore to `false`, and let `BlogPage.mount` turn them on.

- [ ] **Step 6: Implement `NotFoundPage`**

A heading `não achei esse texto`, one line
`talvez ele ainda não exista, ou o endereço veio torto.`, and a link back to
`/blog`. On mount it flies the camera back to the whole tree. Same lowercase
rule, same `data-reveal`.

- [ ] **Step 7: Write `src/styles/prose.css`**

```css
/*
 * O painel de leitura.
 *
 * Texto longo em cima de uma cena 3D que se mexe precisa de um fundo mais
 * calmo que um cartão curto — por isso o desfoque aqui é maior que o do resto
 * do site, e por isso este é o único lugar com uma superfície de verdade.
 */

.leitura {
  max-width: var(--measure);
  margin: 14svh auto 0;
  padding: clamp(24px, 4vw, 44px);
}

/* Folga embaixo. Sem ela, um post curto não tem curso de rolagem e o mundo
   dele nasce pronto — ver `readingProgress`. */
.coluna-leitura {
  padding-bottom: 44svh;
}

.lg-refract .leitura {
  backdrop-filter: url(#lg-displace) blur(22px) saturate(130%);
  -webkit-backdrop-filter: blur(22px) saturate(130%);
}

.voltar {
  display: inline-block;
  font-size: var(--text-sm);
  color: var(--ink-faint);
  text-decoration: none;
  margin-bottom: var(--space-5);
}

.voltar:hover {
  color: var(--green);
}

.carimbo {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--ink-faint);
  margin: 0 0 var(--space-3);
}

.leitura h1 {
  font-size: var(--text-2xl);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: var(--track-tight);
  text-wrap: balance;
  margin: 0 0 var(--space-6);
  color: var(--ink);
}

.prosa-post {
  font-size: var(--text-md);
  line-height: 1.75;
  letter-spacing: var(--track-snug);
  color: var(--ink-dim);
}

.prosa-post > * + * {
  margin-top: var(--space-4);
}

.prosa-post p {
  margin: 0;
  text-wrap: pretty;
}

.prosa-post h2,
.prosa-post h3 {
  color: var(--ink);
  font-weight: 500;
  letter-spacing: var(--track-snug);
  margin-top: var(--space-7);
}

.prosa-post h2 { font-size: var(--text-lg); }
.prosa-post h3 { font-size: var(--text-md); }

.prosa-post a {
  color: var(--green);
  text-decoration: underline;
  text-underline-offset: 0.2em;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--green) 40%, transparent);
}

.prosa-post a:hover {
  text-decoration-color: var(--green);
}

.prosa-post code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-deep);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}

.prosa-post pre {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background: var(--bg-deep);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--space-4);
  overflow-x: auto;
}

.prosa-post pre code {
  background: none;
  border: 0;
  padding: 0;
}

.prosa-post blockquote {
  margin: 0;
  padding-left: var(--space-4);
  border-left: 2px solid color-mix(in srgb, var(--green) 45%, transparent);
  color: var(--ink-faint);
}

.prosa-post img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius);
}

/* ---------- Fio de progresso ---------- */

.leitura-progresso {
  position: fixed;
  inset-block-start: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--green);
  transform-origin: left center;
  z-index: var(--z-cue);
  pointer-events: none;
}
```

and in `src/styles/motion.css`:

```css
/*
 * O fio de progresso é uma animação de rolagem pura: nenhum listener,
 * nenhuma classe, nenhum frame de JS. A linha do tempo é a barra de rolagem
 * do documento, e é só isso que ela precisa saber.
 */
@keyframes encher {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

html[data-reveal-mode='css'] .leitura-progresso {
  animation: encher linear both;
  animation-timeline: scroll(root block);
}

/* Sem linha do tempo de rolagem o fio ficaria parado e cheio, mentindo. */
html:not([data-reveal-mode='css']) .leitura-progresso {
  display: none;
}
```

Import `prose.css` from `src/main.ts`, after `ui.css` and before `motion.css`.

- [ ] **Step 8: Route posts and 404 in `src/main.ts`**

`atribuicoes` already exists from Task 6 Step 7; only the lookup map and the
two new cases are added here.

```ts
const porSlug = new Map(atribuicoes.map((a) => [a.slug, a]))

const router = new Router((match) => {
  switch (match.name) {
    case 'home':
      void host.show(new HomePage())
      return
    case 'blog':
      void host.show(new BlogPage(rig, labels, posts))
      return
    case 'post': {
      const slug = match.params['slug'] ?? ''
      const post = posts.find((p) => p.slug === slug)
      const atribuicao = porSlug.get(slug)
      if (!post || !atribuicao) {
        void host.show(new NotFoundPage(rig, branches))
        return
      }
      void host.show(
        new PostPage(post, atribuicao, rig, labels, stage.scene, stage.camera, quality),
      )
      return
    }
    default:
      void host.show(new NotFoundPage(rig, branches))
  }
})
```

- [ ] **Step 9: Add the Pages deep-link fallback**

GitHub Pages serves `404.html` for any path it has no file for, so a copy of
`index.html` there is what makes a cold load of `/blog/como-cheguei-aqui`
work at all. In `.github/workflows/deploy.yml`, immediately after the
`Build` step:

```yaml
      - name: SPA fallback for deep links
        run: cp dist/index.html dist/404.html
```

- [ ] **Step 10: Browser-verify**

1. Navigate `/` → `/blog` → click the post. Expected: the camera flies along
   the branch, the article renders, the date reads
   `22 de agosto de 2026`, the tab title becomes `como cheguei aqui`, and
   scrolling lights twigs one per paragraph until all six are lit at the
   bottom. The progress hairline fills as you scroll.
2. Hard-reload `/blog/como-cheguei-aqui`. Expected: identical result, no
   flash of the home page.
3. Visit `/blog/nao-existe`. Expected: the not-found page, camera back on the
   whole tree, zero console errors.
4. Navigate away and back five times. In the console,
   `__world.stage.renderer.info.memory` must not climb — that is contract
   item 7 being real.

- [ ] **Step 11: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add -A
git commit -m "feat: a post reads over the world its own text is growing"
```

---

### Task 9: "a rua" — the first post's own world

**Files:**
- Create: `content/worlds/como-cheguei-aqui.ts`
- Modify: nothing. If this task needs to change a file in `src/`, the
  escape hatch is not general enough and that is the bug to fix first.

**Consumes:** `PostWorldContext`, `PostWorldModule`, `beat` from
`src/world/PostWorld.ts`; `branchVertex` / `branchFragment` from
`src/fx/shaders/branch.ts`.
**Produces:** a default-exported `PostWorldModule`.

**Read the IP note in Global Constraints before starting.** Every vertex here
is written in this file. Nothing is extracted from, converted from, or named
after a commercial product, and no logo, wordmark or character name appears in
the code or on screen.

**The image.** You fly into the branch and the twigs do not grow leaves. They
grow a street: two small houses facing each other, a picket fence, a bus
parked at the kerb, and figures standing very still in the yards. All of it in
green wireframe, all of it assembling by wavefront, all of it about the size of
fruit — because it grows *out of* the branch and never replaces the tree. A
whole world on one twig is the site's thesis said out loud.

**The beat that makes it a story rather than a diorama.** The figures do not
move. But each time you look away, one more of them is facing you. They turn
only while outside the camera frustum, so you never catch it happening — you
only ever notice that it has. One figure per paragraph read. By the last
paragraph the whole yard is watching, a siren starts sweeping, the green drifts
warm, and then there is a flash and the street is gone and you are looking at a
branch again.

That is a post about loving a game and thinking work would feel like one.

- [ ] **Step 1: The frame, and the scale**

Everything lives under one `Group` anchored at `ctx.branch.tip`, oriented so
local `+Z` runs along the branch, `+X` across it and `+Y` is world up:

```ts
const UP = new Vector3(0, 1, 0)

const frente = new Vector3(ctx.branch.along.x, 0, ctx.branch.along.z)
// Um galho perfeitamente vertical não tem direção horizontal; nesse caso
// qualquer direção serve, e o que não serve é NaN.
if (frente.lengthSq() < 1e-6) frente.set(0, 0, 1)
frente.normalize()
const lado = new Vector3().crossVectors(UP, frente).normalize()

this.raiz = new Group()
this.raiz.position.copy(ctx.branch.tip)
this.raiz.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(lado, UP, frente))
ctx.scene.add(this.raiz)
```

Scale: the street is **3.2 world units long and 0.9 wide**, the houses 0.55
tall, the bus 0.7 long, the figures 0.22. `flyAlongBranch` frames roughly
three units, so this is exactly what fits — and a model village on a twig is a
better image than a full-size suburb that would swallow the tree.

- [ ] **Step 2: One helper that turns points into a piece**

Every object in the scene is a `Peça`: its own geometry, its own material, its
own wavefront window. The material is `branchVertex` / `branchFragment` from
the tree, unmodified — that is contract item 2, and it is the single thing
that keeps this from looking like a different website.

```ts
/** Um objeto do cenário, com a própria janela de montagem. */
interface Peca {
  linhas: LineSegments
  material: ShaderMaterial
  geometria: BufferGeometry
  /** Trecho do progresso em que ela se monta. */
  de: number
  ate: number
  /** Vértice mais distante da origem local — o quanto a frente de onda anda. */
  alcance: number
}

/**
 * @param pontos pares de vértices, 6 floats por segmento, em coordenadas
 *        locais da peça.
 * @param origem de onde a frente de onda parte, em coordenadas da peça. Cada
 *        peça tem a própria: a casa se monta a partir da base dela, e não a
 *        partir do meio da rua, porque é assim que uma coisa parece ser
 *        construída em vez de aparecer fatiada.
 */
function fazerPeca(
  pontos: number[],
  origem: Vector3,
  profundidade: number,
  de: number,
  ate: number,
): Peca
```

`fazerPeca` fills `position`, `aDist` (distance from `origem`), `aDepth`
(`profundidade`, which the tree's shader already uses to dim thinner things)
and `aBranchId` (`-1`, so the tree's single-branch highlight never fires here),
and builds a `ShaderMaterial` with
`UniformsUtils.merge([UniformsLib.fog, { ...same uniform names as ScanReveal }])`,
`transparent: true`, `depthWrite: false`, `blending: AdditiveBlending`,
`fog: true`. Copy the uniform block from `src/world/ScanReveal.ts` rather than
inventing names — a missing `fogColor` is a WebGL warning at load, and zero
warnings is a release gate.

- [ ] **Step 3: The geometry, six small builders**

Each returns a flat `number[]` of line-segment endpoints in local space. All
of them are a few lines of trigonometry; none of them is clever.

- `caixa(l, a, p)` — the 12 edges of a box centred on its own base.
- `casa(l, a, p, telhado)` — `caixa` plus a gable: two roof slopes meeting at a
  ridge, plus the two gable triangles. One door rectangle and two window
  rectangles on the front face, because a house without openings reads as a
  crate.
- `cerca(comprimento, ripas)` — two horizontal rails and `ripas` vertical
  pickets, each with a small pointed top (two segments), spaced evenly.
- `onibus()` — a `caixa` for the body, a smaller `caixa` set back for the cab,
  four wheels as 8-segment circles in the XY plane.
- `figura()` — a stick figure: two legs, a torso, two arms, and a head as a
  6-segment ring. Kept as its own `Group` so the head can turn independently.
- `chao(lado, divisoes)` — a grid plate, plus a brighter dashed centre line
  running the length of the street.

- [ ] **Step 4: The timeline**

```ts
/**
 * Quando cada coisa se monta, em fração do texto lido.
 *
 * Nada aqui tem relógio próprio — contrato item 5. Parar de rolar congela a
 * rua no meio da construção, que é exatamente o que deve acontecer.
 */
const JANELAS = {
  chao:      [0.00, 0.12],
  casaA:     [0.10, 0.30],
  casaB:     [0.18, 0.38],
  cerca:     [0.32, 0.48],
  onibus:    [0.42, 0.58],
  /** O ônibus chega depois de existir. Montar e entrar são coisas diferentes. */
  chegada:   [0.48, 0.64],
  figuras:   [0.52, 0.84],
  sirene:    [0.80, 0.94],
  /** Volta pro verde antes do fim — contrato item 3. */
  regresso:  [0.94, 0.99],
  clarao:    [0.955, 1.00],
} as const
```

A figure `i` of `n` gets its own window inside `figuras`:
`de = 0.52 + (i / n) * 0.32`, `ate = de + 0.05`.

- [ ] **Step 5: `build(ctx)`**

Assemble the frame, build every piece, and place them:

- `chao` at the origin.
- `casaA` at `(-0.62, 0, -0.5)` facing `+X`; `casaB` at `(0.62, 0, 0.55)`
  facing `-X`. Offset along Z as well as X so the two are not a mirror pair —
  a perfectly symmetric street reads as a diagram.
- `cerca` along `z` at `x = -0.30` and `x = +0.30`, the two kerb lines.
- `onibus` parked at `(0.34, 0, -1.05)`, which is where it *ends up*; its
  local position is lerped from `z = -2.6` during the `chegada` window.
- `figuras`: `Math.min(ctx.post.paragrafos, 8)` of them, positions taken from
  a fixed table of yard spots rather than randomised — a stranger standing in
  the same place every time you visit is much worse and much better than one
  standing somewhere new.
- the siren: a short pole at `(0, 0, 1.4)` with an 8-spoke additive fan at the
  top, rotating on `elapsed` once its window opens.
- the flash: one `<div>` appended to `ctx.overlay`, `position: fixed`,
  `inset: 0`, `background: #d9ffe9`, `opacity: 0`, `pointer-events: none`,
  `z-index: var(--z-veil)`. A DOM element rather than a full-screen quad
  because it costs nothing, composites correctly over both the canvas and the
  article, and is removed in `dispose()` along with everything else.

Cap the figure count at 8: past that the yard stops being unsettling and
starts being a crowd.

- [ ] **Step 6: `update(dt, elapsed, progress)`**

```ts
for (const peca of this.pecas) {
  const t = beat(progress, peca.de, peca.ate)
  // A frente de onda passa um pouco além do último vértice, senão a peça
  // termina de montar exatamente quando a banda clara ainda está em cima
  // dela e o último segmento nunca chega a assentar.
  peca.material.uniforms['uScanRadius']!.value = t * peca.alcance * 1.08
  peca.material.uniforms['uTime']!.value = elapsed
  peca.material.uniforms['uOpacity']!.value = 1 - beat(progress, 0.972, 1.0)
}
```

Palette, satisfying contract item 3 — out to amber and back to green before
the reader leaves:

```ts
const quente = beat(progress, ...JANELAS.sirene) * (1 - beat(progress, ...JANELAS.regresso))
this.corRepouso.copy(VERDE).lerp(AMBAR, quente * 0.85)
this.corBorda.copy(VERDE_QUENTE).lerp(AMBAR_QUENTE, quente * 0.85)
```

Bus arrival: `linhas.position.z = lerp(-2.6, -1.05, easeOutCubic(beat(progress, ...JANELAS.chegada)))`.

Siren: `this.sirene.rotation.y = elapsed * 2.2` while its window is open,
opacity from the same window. Skipped entirely under reduced motion, which
leaves it lit and still.

Flash: `opacity = beat(progress, 0.955, 0.975) * (1 - beat(progress, 0.975, 1.0))`,
multiplied by `0.15` under reduced motion. A spike, not a fade — it peaks at
`0.975` and is gone by the last line.

- [ ] **Step 7: The figures turning**

```ts
/**
 * Elas nunca viram enquanto você está olhando.
 *
 * A cabeça só gira quando a figura está fora do frustum, então o giro é
 * impossível de flagrar — você só percebe que aconteceu. Se ela ficar visível
 * por mais de dois segundos depois de já dever ter virado, ela vira mesmo
 * assim, em 180ms: um segredo que nunca se cumpre vira um bug.
 */
```

Per figure, keep `deveOlhar: boolean`, `virou: boolean` and `esperando: number`.
Each frame:

```ts
this.frustum.setFromProjectionMatrix(
  this.matriz.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse),
)
```
(one `Frustum` and one `Matrix4` allocated in `build`, reused every frame — a
`new Frustum()` per frame per figure is eight allocations a frame for nothing).

If `deveOlhar && !virou`: if `!frustum.containsPoint(mundoDaFigura)`, snap
`cabeca.rotation.y` to face the camera and set `virou = true`. Otherwise
accumulate `esperando += dt`, and past 2 seconds ease the same rotation over
180ms. Under reduced motion, snap on the frame `deveOlhar` becomes true.

The yaw is computed once, at the moment of turning:
`Math.atan2(paraCamera.x, paraCamera.z)` in the figure's parent space — not
tracked per frame. A head that follows the camera is a security camera; a head
that turned once and stayed is a person.

- [ ] **Step 8: `dispose()`**

Remove `raiz` from the scene. For every piece: `geometria.dispose()` and
`material.dispose()`. Dispose the siren's geometry and material. Remove the
flash `<div>`. Null every field. Then verify contract item 7 with the memory
check in Step 10.

- [ ] **Step 9: Export the module**

```ts
/**
 * "a rua" — o mundo do post `como-cheguei-aqui`.
 *
 * Homenagem, não reprodução: cada vértice deste arquivo foi escrito aqui.
 * Duas casas, uma cerca, um ônibus e figuras paradas num quintal são objetos
 * de subúrbio genéricos, e é só isso que eles são.
 *
 * O arquivo é encontrado pelo slug do post. Renomear o post sem renomear este
 * arquivo derruba o post no mundo genérico — `orphanWorlds` avisa em dev.
 */
export default new Rua()
```

`export default new Rua()` and not `export default Rua`: `loadPostWorld`
returns the module's default as a `PostWorldModule` instance, and the glob
loader caches the module, so this object is reused across visits. Every field
it holds must therefore be created in `build` and cleared in `dispose` — no
state may survive on the instance between mounts. This is the one real
footgun in the escape hatch, and it is why `dispose` nulls everything.

- [ ] **Step 10: Browser-verify, slowly**

Open `/blog/como-cheguei-aqui` and scroll in small increments.

1. **0–15%:** a grid plate and a dashed centre line scan themselves in from
   the branch tip outward. The tree is still visible around it.
2. **15–40%:** two houses assemble edge by edge, from their bases up. They are
   not mirror images of each other.
3. **40–65%:** the fence pickets snap in; the bus assembles and then rolls in
   and stops at the kerb.
4. **52–84%:** figures appear one per paragraph. **Scroll down, then look
   away by orbiting the camera with the pointer, then look back.** More of
   them are facing you than were before. You never see one turn.
5. **80–95%:** the siren sweeps, the whole street drifts warm.
6. **95–100%:** a flash, and the street is gone. The tree is exactly where it
   was, unchanged. The palette is green again.
7. Scroll back up: everything reverses cleanly, no artefacts, no stuck
   uniform.

Then: `prefers-reduced-motion: reduce` — every beat lands at the same scroll
position with no travel, the bus is at the kerb from the moment it exists, the
siren does not rotate, the flash never exceeds a faint wash.

Then: navigate `/blog/como-cheguei-aqui` → `/blog` → back, five times, and
confirm `__world.stage.renderer.info.memory` returns to the same numbers.

- [ ] **Step 11: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add -A
git commit -m "feat: the first post grows a street on a twig"
```

---

### Task 10: navigation

**Files:**
- Create: `src/ui/Nav.ts`
- Modify: `index.html`, `src/styles/ui.css`, `src/main.ts`, `src/core/Router.ts`

**Consumes:** `Router`, `RouteName`, `href` from `src/core/routes.ts`,
`site.nav`.
**Produces:**
```ts
export class Nav {
  readonly el: HTMLElement
  constructor(nav: { home: string; blog: string })
  setActive(name: RouteName): void
  dispose(): void
}
```

A fixed segmented control — `início` / `blog` — as a small glass pill whose
indicator slides between segments, refracting the world as it travels.
Mounted **outside** `#ui` so it survives page transitions instead of fading
out with them.

- [ ] **Step 1: Add the mount point to `index.html`**

Between the veil and `<main id="ui">`:

```html
    <nav id="nav" aria-label="seções"></nav>
```

- [ ] **Step 2: Implement `Nav`**

Two `<a>` elements plus one absolutely positioned `<span class="thumb">`.
`setActive` moves the thumb with `transform: translateX()` measured from the
target link's `offsetLeft` / `offsetWidth`, and sets `aria-current="page"` on
the active link, removing it from the other. Never disable or `preventDefault`
the links: they are real hrefs, built with `href()` so the Pages base survives,
and `Router`'s document-level click handler already intercepts them.

The thumb transition uses `--ease-mola` from `motion.css` over 420ms, so it
overshoots slightly and settles — a linear slide reads as a UI widget, and an
overshoot reads as something with weight. Under reduced motion the transition
is removed entirely, not shortened.

- [ ] **Step 3: Mount it, and keep it in sync**

In `src/main.ts`, after the router is created:

```ts
const nav = new Nav(site.nav)
document.getElementById('nav')?.appendChild(nav.el)
```

and call `nav.setActive(match.name)` as the first line of the router handler,
so the thumb moves with the URL rather than with the page transition.

`setActive('notFound')` clears `aria-current` from both links and hides the
thumb — the pill should not claim you are on a page you are not on.

- [ ] **Step 4: Style it in `src/styles/ui.css`**

```css
/* ---------- Navegação ---------- */

#nav {
  position: fixed;
  inset-block-start: max(18px, env(safe-area-inset-top));
  inset-inline-start: 50%;
  translate: -50% 0;
  z-index: var(--z-cue);
}

.pilula {
  position: relative;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--rule);
  background: color-mix(in srgb, var(--bg-deep) 72%, transparent);
  isolation: isolate;
}

.lg-refract .pilula {
  backdrop-filter: url(#lg-displace) blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
}

.lg-fallback .pilula {
  backdrop-filter: blur(16px) saturate(135%);
  -webkit-backdrop-filter: blur(16px) saturate(135%);
}

.pilula a {
  position: relative;
  z-index: 1;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: var(--text-sm);
  letter-spacing: var(--track-snug);
  color: var(--ink-faint);
  text-decoration: none;
  transition: color 240ms var(--ease-saida);
}

.pilula a[aria-current='page'] {
  color: var(--ink);
}

.pilula a:hover {
  color: var(--ink-dim);
}

.thumb {
  position: absolute;
  z-index: 0;
  inset-block: 3px;
  inset-inline-start: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--green) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--green) 34%, transparent);
  transition:
    transform 420ms var(--ease-mola),
    width 420ms var(--ease-mola),
    opacity 200ms var(--ease-saida);
}

.thumb.is-oculta {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .thumb,
  .pilula a {
    transition: none;
  }
}
```

`#nav` is outside `#ui`, so it does not inherit the
`#ui > * { pointer-events: none }` rule and needs none of its own.

- [ ] **Step 5: Browser-verify**

Expected: the thumb slides between the two segments and settles with a small
overshoot; `aria-current` moves with it; the world does not reload or
re-scan; Tab reaches both links with a visible focus ring; Enter navigates;
the browser back button moves the thumb too. On `/blog/nao-existe` the thumb
is hidden and neither link claims to be current. On a 375px-wide viewport the
pill is still fully on screen and does not overlap the `h1`.

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A && git commit -m "feat: liquid-glass segmented navigation"
```

---

### Task 11: wind, and fireflies that follow you

**Files:**
- Create: `src/world/Wind.ts`, `src/world/Fireflies.ts`,
  `src/fx/shaders/fireflies.ts`, `src/world/__tests__/Wind.test.ts`
- Modify: `src/fx/shaders/branch.ts`, `src/world/ScanReveal.ts`, `src/main.ts`,
  `content/worlds/como-cheguei-aqui.ts` (step 3 — the two new uniforms)

**Produces:**
```ts
export class Wind {
  push(dx: number, dy: number): void
  update(dt: number): void
  readonly vector: Vector2
  readonly strength: number
}
export class Fireflies {
  readonly points: Points
  constructor(quality: Quality)
  update(dt: number, elapsed: number, pointerWorld: Vector3): void
  setDpr(dpr: number): void
  dispose(): void
}
```

- [ ] **Step 1: Write the failing `Wind` tests**

Create `src/world/__tests__/Wind.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Wind } from '../Wind'

describe('Wind', () => {
  it('começa parado', () => expect(new Wind().strength).toBe(0))

  it('ganha força num empurrão e decai até sumir', () => {
    const w = new Wind()
    w.push(1, 0)
    w.update(1 / 60)
    expect(w.strength).toBeGreaterThan(0)
    for (let i = 0; i < 600; i++) w.update(1 / 60)
    expect(w.strength).toBeLessThan(0.01)
  })

  it('satura, por mais forte que seja o empurrão', () => {
    const w = new Wind()
    for (let i = 0; i < 200; i++) w.push(10, 10)
    w.update(1 / 60)
    expect(w.strength).toBeLessThanOrEqual(1)
  })

  it('aponta pro lado que foi empurrado', () => {
    const w = new Wind()
    w.push(-1, 0)
    w.update(1 / 60)
    expect(w.vector.x).toBeLessThan(0)
  })

  it('um dt gigante não faz a força explodir nem virar NaN', () => {
    // Uma aba que volta do background entrega um dt de vários segundos.
    const w = new Wind()
    w.push(1, 1)
    w.update(5)
    expect(Number.isFinite(w.strength)).toBe(true)
    expect(w.strength).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run, watch it fail, implement `Wind`, run again**

Exponential decay toward zero, clamped to 1, the direction damped toward the
raw accumulated push. `update` clamps `dt` before using it.

Run: `npx vitest run src/world/__tests__/Wind.test.ts`
Expected: FAIL first, then PASS with 5 tests.

- [ ] **Step 3: Bend the branches in `branchVertex`**

In `src/fx/shaders/branch.ts`, add `uniform vec2 uWind;` and
`uniform float uWindTime;` to the vertex shader, and:

```glsl
  // O balanço cresce com a altura acima das raízes, então o tronco segura e a
  // copa se mexe. Balanço uniforme lê como a imagem inteira tremendo.
  float sway = max(position.y + 2.4, 0.0) * 0.045;
  float phase = uWindTime * 2.2 + position.y * 0.35;
  vec3 bent = position;
  bent.xz += uWind * sway * (0.75 + 0.25 * sin(phase));
```

Use `bent` in the `modelViewMatrix` product. `aDist` stays computed on the
**unbent** position — it comes in as an attribute and must not be recomputed
here, or the wind would drag the scan wavefront around with it.

Add the two uniforms to `ScanReveal`'s line material with default
`new Vector2()` and `0`, and a `setWind(vector: Vector2, time: number)`
method. The marker material does not read wind: markers sit on the geometry
they were generated from, and bending one without the other separates them.
Note that as a known, accepted limitation in a comment — the alternative is
duplicating the bend in a second shader for a handful of pixels.

Task 9's pieces use the same fragment/vertex pair, so they now declare
`uWind` and `uWindTime` too. They are left at zero: a street on a twig that
sways with the canopy would read as an earthquake. Set them explicitly to
zero in `fazerPeca` rather than relying on the default.

- [ ] **Step 4: Implement `Fireflies`**

60 / 36 / 18 by tier — small numbers on purpose, since a swarm reads as dust
and a handful reads as creatures. Each steers toward a point lagging behind
the pointer by a per-insect delay, plus a `curl3` wander from
`src/util/noise.ts`, with velocity damped hard. Blink with
`0.35 + 0.65 * pow(sin(uTime * rate + phase) * 0.5 + 0.5, 3.0)` so each has a
long dark part of its cycle.

The existing motes are *repelled* by the pointer; these are attracted, which
is what makes the repulsion read as a choice rather than as physics.

Both wind and fireflies are skipped entirely under reduced motion —
`Wind.push` becomes a no-op and `Fireflies` is never added to the scene.

- [ ] **Step 5: Wire into `src/main.ts`**

Feed `pointer` drag deltas into `wind.push`, call `wind.update(dt)` and
`scan.setWind(wind.vector, elapsed)` in the existing world tick, and add the
fireflies to the scene and to `stage.onResize` alongside the motes.

- [ ] **Step 6: Browser-verify**

Drag across the canvas: the canopy leans and springs back over about a second
while the trunk base holds, and the scan still gates correctly afterwards
(check by `__world.freezeScan(0.5)` — the wavefront must still be a clean
sphere, not a smear). Move the pointer slowly: a handful of green points
converge behind it, blinking out of phase. Both off under reduced motion.

- [ ] **Step 7: Commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A && git commit -m "feat: wind on drag and fireflies that follow you"
```

---

### Task 12: verification pass

No new features. This is the gate.

- [ ] **Step 1:** `npx tsc --noEmit` — expected clean.
- [ ] **Step 2:** `npx vitest run` — expected all green, and the file count
      includes `plugins/__tests__/posts.test.ts`. If Vitest reports fewer
      files than exist on disk, Task 4 Step 2 regressed.
- [ ] **Step 3:** `npm run build` — clean. Confirm `dist/404.html` exists
      after the workflow's copy step (locally: run the `cp` by hand and check).
      Record the bundle size in the commit message.
- [ ] **Step 4:** Load `/`, `/blog`, `/blog/como-cheguei-aqui`,
      `/blog/nao-existe`. Expected: zero console errors and zero WebGL
      warnings on each. Check `__world.stage.renderer.info.programs` does not
      grow on repeated navigation.
- [ ] **Step 5:** Confirm no uppercase and no English survives in the shipped
      copy:

```bash
grep -nE '(Nicholas|Engenheiro|Selected work|Elsewhere|Scroll|Available for work|Staff Front-End)' dist/index.html dist/assets/*.js
```
      Expected: no matches.
- [ ] **Step 6:** Re-run the contrast table from the spec against the shipped
      tokens. Expected: nothing below 4.5:1. Check the post prose specifically
      — `--ink-dim` on the reader pane at `blur(22px)` over the brightest part
      of the lit street is the new worst case and was not measured before.
- [ ] **Step 7:** Resize to 375×812. Expected: no horizontal overflow on any
      route; the nav pill clears the `h1`; branch labels stay legible; the
      reader pane's padding does not squeeze the measure below 30 characters.
- [ ] **Step 8:** Emulate `prefers-reduced-motion: reduce`. Expected: no intro
      sweep, no scroll reveals, no camera dolly, no wind, no fireflies, no
      thumb slide, camera snaps between routes, the street's beats land
      without travel, the flash stays faint, and the site is fully usable.
- [ ] **Step 9:** Keyboard-only pass across all four routes. Expected: the
      nav, the blog fallback list, the post's back link, the prose links and
      the contact links are all reachable with a visible focus ring; nothing
      non-interactive is focusable; the passions list is *not* in the tab
      order, because hovering it only lights a decorative ring and the name is
      already there as text.
- [ ] **Step 10:** Firefox pass (or whichever engine reports
      `data-reveal-mode="js"`). Expected: reveals still happen via the
      observer, the progress hairline is hidden rather than stuck, glass falls
      back to blur without refraction, no console error.
- [ ] **Step 11:** Fix everything found, re-run 1–10 until clean, commit.

```bash
git add -A && git commit -m "chore: milestone c verification pass"
```

- [ ] **Step 12:** Update `README.md` — the concept in one paragraph, how to
      write a post, how to add a bespoke world (with the world contract's
      seven items copied in, and the slug-rename footgun called out), the
      routing and the Pages 404 fallback, and the lowercase rule with a
      pointer at the test that enforces it.

```bash
git add -A && git commit -m "docs: how to write a post and how to build it a world"
```

---

## Self-Review

**Spec coverage.**

| Requirement | Where |
| --- | --- |
| Title and `h1` = `nicholas ferrer alencar` | Task 1, steps 3 and 8 |
| Everything lowercase, name included | Task 1, enforced by test |
| More animation with modern CSS, throughout | Task 3 (`view()` reveals, `linear()`, `:has()`, `@property`), Task 8 (`scroll()` hairline), Task 10 (spring thumb) |
| Drop the surf/12-years framing | Task 2 — years, `Habilidade` and `anosDe` all deleted |
| Passions instead, categorised | Task 2 — `paixoes.ts`, two categories, one ring each |
| Milestone C: the blog | Tasks 4–11 |
| A post is a branch | Task 6 `assignBranches`, Task 8 `flyAlongBranch` |
| Each post a different branch, environment, story | Task 7 escape hatch + the world contract |
| The first post is about games, in Three.js | Task 9 |
| Entering a branch keeps the site's identity | The world contract, items 1–4; Task 9 uses the tree's own shaders |
| Nicholas writes the prose | Task 4 step 9 ships a marked scaffold and nothing else |

**Gaps deliberately left, and why.**

- **Nicholas's prose.** Six scaffold paragraphs, each marked. The world needs
  a paragraph count to exist; the words are his.
- **Notes for `cozinhar` and `cerâmica`.** `surf` and `forró` carry a line
  because he wrote those lines. Inventing two more would put sentences about
  his life in his mouth. `nota` is optional and those two ship without one.
- **`cerâmica` is a guess** at what "hot ceramics" meant. One word in
  `src/content/paixoes.ts`, one line to change.
- **RSS and the cat's `notice` state** (the spec's Task 15) are Milestone D
  and are not in this plan.
- **The View Transition API** is argued against in Task 3 rather than
  silently omitted.

**Type consistency, checked across tasks.** `Paixao` / `Grupo` /
`agruparPaixoes` / `alturasDosAneis` are defined in Task 2 and consumed by
`TrunkRings` and `HomePage` in the same task. `Post` is defined in Task 4 and
consumed as a type-only import everywhere after, so no runtime resolution of
`virtual:posts` is needed under Vitest. `PostBranch` is produced by Task 6 and
consumed by Tasks 8 and 9. `beat`, `twigLit` and `hueDaTag` are defined in
Task 7 and `beat` is consumed by Task 9. `PostWorldContext.camera` and
`.overlay` are declared in Task 7 precisely because Task 9 needs the frustum
test and the flash overlay — a world module that had to reach for a global to
get either would break the escape hatch.

**Running test count:** 86 baseline → 91 (T1) → 101 (T2) → 105 (T3) →
123 (T4) → 130 (T5) → 141 (T6) → 155 (T7) → 161 (T8) → 166 (T11).
