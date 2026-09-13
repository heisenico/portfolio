# Portfolio Astro + Ambient Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the portfolio from scratch as an Astro static site (Home + Diário digital) with a persistent three.js/audio ambient island, deployed to GitHub Pages.

**Architecture:** Astro 5 + strict TypeScript, no UI framework. Static HTML pages per locale; markdown diary via content collections; one persistent island (`transition:persist`) holding the WebGL field canvas and the Web Audio engine so both survive view-transition navigations. Interactive map is SVG; three.js adds depth (glow + tilt) behind it.

**Tech Stack:** Astro ^5, three ^0.180, TypeScript ^5 (strict), Vitest ^3, Playwright ^1 + @axe-core/playwright, GitHub Actions + withastro/action.

**Spec:** `docs/superpowers/specs/2026-09-13-portfolio-astro-ambient-design.md` — and via it, `README.md` at repo root is the **visual fidelity source** (tokens, type scale, spacing, verbatim copy, map coordinates, artboard layouts). The mock in `design-reference/` is the visual reference to compare against in a browser. Executors must read both spec and README before starting.

## Global Constraints

- TypeScript `strict`; no UI framework — Astro components + small vanilla scripts only.
- Vite base path is `/portfolio`; **every** internal URL goes through the `localeUrl()` helper (Task 3). Never hardcode `/diario/...`.
- pt-BR copy is **verbatim from README §Copy** — lowercase styling included ("nicholas ferrer", "diário digital"). Never "fix" its casing.
- Body-size blue text always uses `--lb-700` (#1c31a0), never `--lb` (#2743c9) — 4.5:1 contrast rule, guarded by test.
- No magenta/cyan anywhere; the Luminous Blue ramp from README §Design Tokens replaces them.
- Sound never autoplays — first `pointerdown`/`keydown` gesture only. No interaction sound before first gesture or while muted.
- `prefers-reduced-motion` collapses ALL motion: static field, no tilt, no transition fades, sound bars static at `scaleY(.6)`.
- WebGL canvas DPR capped at 2; rAF paused when `document.hidden`.
- The 14 place ids (Task 4) are the only legal `place` values in diary frontmatter — schema-enforced.
- Locales: `pt` (default, unprefixed), `en`, `fr`, `es`, `zh`, `ja` (prefixed). String fallback chain: `locale → en → pt`.
- Commit messages follow the repo's style: pt-BR, lowercase, plain-spoken (`git log` for examples).

---

### Task 1: Recomeço — wipe commit + Astro scaffold

**Files:**
- Move: `Portfolio nico fada.dc.html`, `support.js`, `_ds/` → `design-reference/`
- Create: `package.json`, `astro.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/pages/index.astro`, `public/favicon.svg`
- Delete (commit the already-deleted old project files)

**Interfaces:**
- Produces: a building Astro skeleton; `npm run dev|build|preview|test` scripts every later task uses.

- [ ] **Step 1: Move the design reference and commit the wipe**

```bash
mkdir design-reference
mv "Portfolio nico fada.dc.html" support.js _ds design-reference/
git add -A
git commit -m "recomeço: apaga o projeto antigo, guarda o handoff e a referência de design"
```

The old project's deletions are already in the working tree; `git add -A` stages them plus the moved reference and the new README. Verify with `git status --short` → clean tree afterwards.

- [ ] **Step 2: Write the scaffold files**

`package.json`:

```json
{
  "name": "portfolio",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

`astro.config.ts`:

```ts
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://heisenico.github.io',
  base: '/portfolio',
  i18n: {
    locales: ['pt', 'en', 'fr', 'es', 'zh', 'ja'],
    defaultLocale: 'pt',
    routing: { prefixDefaultLocale: false },
  },
});
```

(Doc: docs.astro.build/en/guides/internationalization/ — we use the config for `Astro.currentLocale`; locale page generation is ours, Task 9.)

`tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*", "plugins/**/*"],
  "exclude": ["dist"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/__tests__/**/*.test.ts'] },
});
```

`.gitignore`:

```
node_modules
dist
.astro
test-results
playwright-report
.DS_Store
```

`src/pages/index.astro` (placeholder, replaced in Task 7):

```astro
---
---
<html lang="pt-BR"><head><meta charset="utf-8" /><title>nicholas ferrer</title></head>
<body><h1>nicholas ferrer</h1></body></html>
```

`public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#f3f2f2"/><circle cx="16" cy="16" r="7" fill="#2743c9"/></svg>
```

- [ ] **Step 3: Install and verify the build**

```bash
npm install astro typescript
npm install -D vitest
npm run build
```

Expected: build succeeds, `dist/index.html` exists. `npm run preview` serves at `http://localhost:4321/portfolio/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: esqueleto astro — typescript estrito, base /portfolio"
```

---

### Task 2: Tokens, base styles, contrast guard

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`
- Test: `src/styles/__tests__/contraste.test.ts`, helper `src/styles/__tests__/wcag.ts`

**Interfaces:**
- Produces: CSS custom properties every component uses: `--lb`, `--lb-100…900`, `--color-bg`, `--color-text`, `--font-serif`, glass recipe classes `.glass`, field fallback `.field-css`, halftone `.halftone-overlay`.

- [ ] **Step 1: Write the token sheet**

Start from `design-reference/_ds/**/styles.css` (the handoff allows copying it), keep its font/spacing structure, replace all cyan/magenta with the blue ramp. The result must contain exactly these values (README §Design Tokens):

`src/styles/tokens.css`:

```css
:root {
  --font-serif: "Source Serif 4", Georgia, "Times New Roman", serif;
  --color-bg: #f3f2f2;
  --color-text: #201e1d;
  --lb: #2743c9;
  --lb-100: #ecf0ff;
  --lb-200: #d5ddff;
  --lb-300: #b0bfff;
  --lb-400: #7f95f5;
  --lb-500: #4f6be0;
  --lb-700: #1c31a0;
  --lb-900: #0e1750;
  --radius-glass: 18px;
  --radius-nav: 12px;
  --radius-thumb: 10px;
  --radius-pill: 999px;
}
```

`src/styles/base.css` — global reset + the shared recipes:

```css
* { box-sizing: border-box; margin: 0; }
html { font-family: var(--font-serif); color: var(--color-text); background: var(--color-bg); }
body { min-height: 100dvh; }

.glass {
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8) inset, 0 12px 32px rgba(14, 23, 80, 0.14);
  border-radius: var(--radius-glass);
  position: relative;
  overflow: hidden;
}
@supports (backdrop-filter: blur(1px)) {
  .glass { backdrop-filter: blur(18px) saturate(1.5); }
}
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: rgba(255, 255, 255, 0.85); }
}
.glass::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,.55), transparent 40%, transparent 70%, rgba(255,255,255,.25));
}

/* CSS fallback for the WebGL field; stays underneath everything */
.field-css {
  position: fixed; inset: 0; z-index: -2; pointer-events: none;
  background:
    radial-gradient(60% 55% at var(--field-x, 80%) var(--field-y, 85%), color-mix(in srgb, var(--lb) 55%, transparent), transparent 70%),
    radial-gradient(45% 40% at calc(var(--field-x, 80%) - 12%) calc(var(--field-y, 85%) - 10%), color-mix(in srgb, var(--lb-500) 45%, transparent), transparent 70%),
    radial-gradient(70% 60% at calc(var(--field-x, 80%) + 8%) calc(var(--field-y, 85%) + 8%), color-mix(in srgb, var(--lb-300) 60%, transparent), transparent 75%),
    var(--color-bg);
}
.halftone-overlay {
  position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background-image: radial-gradient(circle, rgba(14, 23, 80, 0.18) 30%, transparent 32%);
  background-size: 3px 3px;
  mix-blend-mode: multiply;
  opacity: 0.5;
}

a { color: var(--lb-700); text-decoration: none; }
a:hover { color: var(--lb); }
:focus-visible { outline: 2px solid var(--lb); outline-offset: 2px; }

.skip-link {
  position: absolute; left: -9999px; top: 8px; z-index: 10;
  background: #fff; color: var(--lb-700); padding: 8px 14px; border-radius: var(--radius-pill);
}
.skip-link:focus-visible { left: 8px; }
```

Home pages set `--field-x: 80%; --field-y: 85%` (lower-right); diário pages set `--field-x: 15%; --field-y: 40%` (left).

- [ ] **Step 2: Write the failing contrast test**

`src/styles/__tests__/wcag.ts`:

```ts
export function relativeLuminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(fg: string, bg: string): number {
  const [l1, l2] = [relativeLuminance(fg), relativeLuminance(bg)].sort((a, b) => b - a);
  return (l1! + 0.05) / (l2! + 0.05);
}
```

`src/styles/__tests__/contraste.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './wcag';

const tokens = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const m = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} não encontrado`);
  return m[1]!;
};

describe('contraste no papel', () => {
  it('texto azul de corpo (--lb-700) tem 4.5:1 sobre o fundo', () => {
    expect(contrastRatio(token('--lb-700'), token('--color-bg'))).toBeGreaterThanOrEqual(4.5);
  });
  it('texto principal tem 4.5:1 sobre o fundo', () => {
    expect(contrastRatio(token('--color-text'), token('--color-bg'))).toBeGreaterThanOrEqual(4.5);
  });
  it('--lb base NÃO passa para texto de corpo — é por isso que a regra existe', () => {
    expect(contrastRatio(token('--lb'), token('--color-bg'))).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 3: Run the test — must pass against the written tokens**

Run: `npx vitest run src/styles`
Expected: 3 passing. (If `--lb-700` fails 4.5:1, the token was mistyped — fix the token, never the threshold.)

- [ ] **Step 4: Commit**

```bash
git add src/styles
git commit -m "feat: tokens do azul luminoso, vidro e campo css — com guarda de contraste"
```

---

### Task 3: i18n dictionaries, fallback, URL + date helpers

**Files:**
- Create: `src/i18n/types.ts`, `src/i18n/pt.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`
- Test: `src/i18n/__tests__/i18n.test.ts`

**Interfaces:**
- Produces:
  - `type Locale = 'pt' | 'en' | 'fr' | 'es' | 'zh' | 'ja'`; `const LOCALES: readonly Locale[]`
  - `getStrings(locale: Locale): UIStrings` — fallback `locale → en → pt`
  - `localeUrl(locale: Locale, path: string, base?: string): string` — base-aware URL builder
  - `formatDayMonth(date: Date, locale: Locale): string` → "04 set"; `formatEntryDate(date, locale)` → "04 set 2026"
  - `htmlLang(locale: Locale): string` → 'pt-BR', 'en', 'fr', 'es', 'zh-Hans', 'ja'

- [ ] **Step 1: Write the failing tests**

`src/i18n/__tests__/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LOCALES, formatDayMonth, formatEntryDate, getStrings, htmlLang, localeUrl } from '../index';

describe('fallback de strings', () => {
  it('pt devolve o pt verbatim', () => {
    expect(getStrings('pt').brand).toBe('nicholas ferrer');
    expect(getStrings('pt').bio[0]).toMatch(/^eu moro no rio de janeiro\./);
  });
  it('fr cai para o inglês (não para pt)', () => {
    expect(getStrings('fr')).toEqual(getStrings('en'));
  });
  it('todas as seis locales resolvem sem lançar', () => {
    for (const l of LOCALES) expect(getStrings(l).brand).toBe('nicholas ferrer');
  });
});

describe('localeUrl', () => {
  it('pt fica sem prefixo, sob a base', () => {
    expect(localeUrl('pt', '/diario/', '/portfolio/')).toBe('/portfolio/diario/');
  });
  it('en ganha prefixo', () => {
    expect(localeUrl('en', '/diario/', '/portfolio/')).toBe('/portfolio/en/diario/');
  });
  it('raiz pt é a base', () => {
    expect(localeUrl('pt', '/', '/portfolio/')).toBe('/portfolio/');
  });
});

describe('datas', () => {
  const d = new Date('2026-09-04T12:00:00Z');
  it('curta pt', () => expect(formatDayMonth(d, 'pt')).toBe('04 set'));
  it('longa pt', () => expect(formatEntryDate(d, 'pt')).toBe('04 set 2026'));
  it('curta en', () => expect(formatDayMonth(d, 'en')).toBe('04 sep'));
});

describe('htmlLang', () => {
  it('pt-BR e zh-Hans', () => {
    expect(htmlLang('pt')).toBe('pt-BR');
    expect(htmlLang('zh')).toBe('zh-Hans');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/i18n`
Expected: FAIL — module `../index` not found.

- [ ] **Step 3: Implement**

`src/i18n/types.ts`:

```ts
export const LOCALES = ['pt', 'en', 'fr', 'es', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export interface UIStrings {
  brand: string;
  skipLink: string;
  navHome: string;
  navDiario: string;
  soundPlaying: string;   // aria-label
  soundPaused: string;    // aria-label
  h1Lines: [string, string];
  bio: [string, string, string];
  mapKicker: string;
  mapCountLine: (places: number) => string;
  mapCaptionMobile: string;
  mapCaptionDesktopA: string;
  mapCaptionDesktopB: string;
  nodeAriaLabel: (place: string, count: number) => string;
  conviteKicker: string;
  conviteIntro: string;
  links: { label: string; href: string; note: string }[];
  diarioCta: string;
  diarioLast: (dayMonth: string) => string;
  footerExperiment: string;   // contains {github} marker replaced with the link
  footerSound: string;
  diarioKicker: string;
  diarioH1: string;
  diarioIntro: string;        // contains {youtube} marker
  inPortuguese: string;       // "em português" tag
  filterShowing: (place: string) => string;
  filterClear: string;
  seeOnMap: string;
  notTranslated: string;      // note atop fallback-rendered pages
}
```

`src/i18n/pt.ts` — **copy verbatim from README §Copy and §Screens**; the exact object:

```ts
import type { UIStrings } from './types';

export const pt: UIStrings = {
  brand: 'nicholas ferrer',
  skipLink: 'pular para o conteúdo',
  navHome: 'home',
  navDiario: 'diário digital',
  soundPlaying: 'som: tocando',
  soundPaused: 'som: pausado',
  h1Lines: ['nicholas', 'ferrer'],
  bio: [
    'eu moro no rio de janeiro. trabalho com desenvolvimento de software na base exchange, ajudo a criar uma nova bolsa de valores no Brasil.',
    'gosto muito de aprender sobre coisas novas. engenharia, design, arte, música, cinema, literatura.',
    'se estiver pelo rio e quiser trocar uma idea, me mande uma DM. adoraria tomar um café e conversar sobre criar coisas novas, fazer a web mais acessível e divertida, além de claro, IA.',
  ],
  mapKicker: 'por onde passei',
  mapCountLine: (n) => `${n} lugares · 1 próximo`,
  mapCaptionMobile: 'nômade digital, raiz no rio. toque em um nó para ler o que vivi lá.',
  mapCaptionDesktopA: 'nômade digital, raiz no rio.',
  mapCaptionDesktopB: 'passe o mouse em um nó para ler.',
  nodeAriaLabel: (place, count) =>
    count === 1 ? `${place}, 1 entrada no diário` : `${place}, ${count} entradas no diário`,
  conviteKicker: 'convite',
  conviteIntro: 'pra trabalho criativo, de engenharia a design:',
  links: [
    { label: 'youtube', href: 'https://www.youtube.com/@heisenico', note: 'um diário digital. também falo de javascript e faço umas playlists legais!' },
    { label: 'goodreads', href: 'https://www.goodreads.com/user/show/203531558-nicholas', note: 'o que eu ando lendo.' },
    { label: 'letterboxd', href: 'https://letterboxd.com/nicholasferrer/', note: 'o que eu ando assistindo.' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/ferrernicholas/', note: 'a parte formal' },
    { label: 'github', href: 'https://github.com/heisenico', note: 'onde este site mora.' },
  ],
  diarioCta: 'diário digital',
  diarioLast: (d) => `último: ${d} →`,
  footerExperiment:
    'esse site é um experimento. é uma forma de criar arte na web. espero que esteja curtindo essa passagem por aqui. é feito com typescript, three.js e vite. o código fonte está no {github}.',
  footerSound: 'som: deep house sem vocal, toca no primeiro toque. desligue na barra acima.',
  diarioKicker: 'diário digital',
  diarioH1: 'o que eu ando vivendo',
  diarioIntro: 'notas curtas, fotos e vídeos do caminho. os vídeos moram no {youtube}.',
  inPortuguese: 'em português',
  filterShowing: (place) => `mostrando: ${place}`,
  filterClear: 'limpar',
  seeOnMap: 'ver no mapa →',
  notTranslated: 'ainda em inglês por aqui — tradução vem.',
};
```

`src/i18n/en.ts` — drafted English (Nicholas reviews later; spec §12):

```ts
import type { UIStrings } from './types';

export const en: UIStrings = {
  brand: 'nicholas ferrer',
  skipLink: 'skip to content',
  navHome: 'home',
  navDiario: 'digital diary',
  soundPlaying: 'sound: playing',
  soundPaused: 'sound: paused',
  h1Lines: ['nicholas', 'ferrer'],
  bio: [
    'i live in rio de janeiro. i work in software development at base exchange, helping build a new stock exchange in Brazil.',
    'i love learning new things. engineering, design, art, music, film, literature.',
    "if you're around rio and want to talk, send me a DM. i'd love to grab a coffee and chat about making new things, making the web more accessible and fun — and of course, AI.",
  ],
  mapKicker: 'where i have been',
  mapCountLine: (n) => `${n} places · 1 next`,
  mapCaptionMobile: 'digital nomad, roots in rio. tap a node to read what i lived there.',
  mapCaptionDesktopA: 'digital nomad, roots in rio.',
  mapCaptionDesktopB: 'hover a node to read.',
  nodeAriaLabel: (place, count) =>
    count === 1 ? `${place}, 1 diary entry` : `${place}, ${count} diary entries`,
  conviteKicker: 'invitation',
  conviteIntro: 'for creative work, from engineering to design:',
  links: [
    { label: 'youtube', href: 'https://www.youtube.com/@heisenico', note: 'a digital diary. i also talk javascript and make some nice playlists!' },
    { label: 'goodreads', href: 'https://www.goodreads.com/user/show/203531558-nicholas', note: 'what i am reading.' },
    { label: 'letterboxd', href: 'https://letterboxd.com/nicholasferrer/', note: 'what i am watching.' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/ferrernicholas/', note: 'the formal part' },
    { label: 'github', href: 'https://github.com/heisenico', note: 'where this site lives.' },
  ],
  diarioCta: 'digital diary',
  diarioLast: (d) => `latest: ${d} →`,
  footerExperiment:
    'this site is an experiment. a way of making art on the web. i hope you are enjoying your time here. it is built with typescript, three.js and vite. the source code is on {github}.',
  footerSound: 'sound: no-vocal deep house, starts on your first tap. turn it off in the bar above.',
  diarioKicker: 'digital diary',
  diarioH1: 'what i have been living',
  diarioIntro: 'short notes, photos and videos from the road. the videos live on {youtube}.',
  inPortuguese: 'em português',
  filterShowing: (place) => `showing: ${place}`,
  filterClear: 'clear',
  seeOnMap: 'see on the map →',
  notTranslated: 'still in english here — translation coming.',
};
```

`src/i18n/index.ts`:

```ts
import { en } from './en';
import { pt } from './pt';
import { LOCALES, type Locale, type UIStrings } from './types';

export { LOCALES };
export type { Locale, UIStrings };

const dictionaries: Partial<Record<Locale, UIStrings>> = { pt, en };

export function getStrings(locale: Locale): UIStrings {
  return dictionaries[locale] ?? dictionaries.en ?? pt;
}

export function isTranslated(locale: Locale): boolean {
  return locale in dictionaries;
}

export function localeUrl(locale: Locale, path: string, base: string = import.meta.env.BASE_URL): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  return `${cleanBase}${prefix}${path}`;
}

const MONTHS: Record<Locale, string[]> = {
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  en: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};

export function formatDayMonth(date: Date, locale: Locale): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[locale][date.getUTCMonth()]}`;
}

export function formatEntryDate(date: Date, locale: Locale): string {
  return `${formatDayMonth(date, locale)} ${date.getUTCFullYear()}`;
}

export function htmlLang(locale: Locale): string {
  return { pt: 'pt-BR', en: 'en', fr: 'fr', es: 'es', zh: 'zh-Hans', ja: 'ja' }[locale];
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run src/i18n`
Expected: all passing. (Note the `import.meta.env.BASE_URL` default only resolves inside Astro/Vite — tests always pass `base` explicitly, which is why the parameter exists.)

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "feat: dicionários pt e en, fallback para o inglês, urls e datas por locale"
```

---

### Task 4: Map data module

**Files:**
- Create: `src/map/places.ts`
- Test: `src/map/__tests__/places.test.ts`

**Interfaces:**
- Produces:
  - `const PLACE_IDS: readonly [...14 ids]`; `type PlaceId`
  - `const PLACES: Record<PlaceId, { label: string; cx: number; cy: number; next?: true }>`
  - `const EDGES: string` and `const EDGE_NEXT: string` (SVG path data)
  - `const ROOT: PlaceId = 'rio'`

- [ ] **Step 1: Write the failing test** — the coordinates are load-bearing (README §Map, verbatim):

`src/map/__tests__/places.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EDGES, EDGE_NEXT, PLACES, PLACE_IDS, ROOT } from '../places';

describe('o mapa bate com o handoff', () => {
  it('tem os 14 lugares', () => expect(PLACE_IDS).toHaveLength(14));
  it('coordenadas verbatim do README', () => {
    expect([PLACES.rio.cx, PLACES.rio.cy]).toEqual([41.4, 83.7]);
    expect([PLACES.tiradentes.cx, PLACES.tiradentes.cy]).toEqual([40.7, 82]);
    expect([PLACES.salvador.cx, PLACES.salvador.cy]).toEqual([38, 75.4]);
    expect([PLACES.recife.cx, PLACES.recife.cy]).toEqual([45.2, 74.3]);
    expect([PLACES['joao-pessoa'].cx, PLACES['joao-pessoa'].cy]).toEqual([48.1, 69.6]);
    expect([PLACES.natal.cx, PLACES.natal.cy]).toEqual([48.1, 68.7]);
    expect([PLACES.atins.cx, PLACES.atins.cy]).toEqual([47.8, 67.4]);
    expect([PLACES['chapada-dos-veadeiros'].cx, PLACES['chapada-dos-veadeiros'].cy]).toEqual([41.8, 64.4]);
    expect([PLACES['buenos-aires'].cx, PLACES['buenos-aires'].cy]).toEqual([29.3, 94.9]);
    expect([PLACES.havana.cx, PLACES.havana.cy]).toEqual([10.1, 39.9]);
    expect([PLACES.cancun.cx, PLACES.cancun.cy]).toEqual([6.5, 41.8]);
    expect([PLACES['washington-dc'].cx, PLACES['washington-dc'].cy]).toEqual([14.4, 24.9]);
    expect([PLACES['new-york'].cx, PLACES['new-york'].cy]).toEqual([16.8, 23.1]);
    expect([PLACES.estonia.cx, PLACES.estonia.cy]).toEqual([95.8, 5.3]);
  });
  it('rio é a raiz, estônia é o próximo', () => {
    expect(ROOT).toBe('rio');
    expect(PLACES.estonia.next).toBe(true);
    expect(Object.values(PLACES).filter((p) => p.next)).toHaveLength(1);
  });
  it('as arestas são as do README', () => {
    expect(EDGES).toBe(
      'M41.4 83.7 L40.7 82 M41.4 83.7 L38 75.4 M41.4 83.7 L45.2 74.3 L48.1 69.6 L48.1 68.7 L47.8 67.4 L41.8 64.4 M41.4 83.7 L29.3 94.9 M41.4 83.7 L10.1 39.9 L6.5 41.8 M10.1 39.9 L14.4 24.9 L16.8 23.1',
    );
    expect(EDGE_NEXT).toBe('M16.8 23.1 Q60 -6 95.8 5.3');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/map` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/map/places.ts`**

```ts
export const PLACE_IDS = [
  'rio', 'tiradentes', 'salvador', 'recife', 'joao-pessoa', 'natal', 'atins',
  'chapada-dos-veadeiros', 'buenos-aires', 'havana', 'cancun', 'washington-dc',
  'new-york', 'estonia',
] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

export interface Place { label: string; cx: number; cy: number; next?: true }

export const PLACES: Record<PlaceId, Place> = {
  rio: { label: 'rio de janeiro', cx: 41.4, cy: 83.7 },
  tiradentes: { label: 'tiradentes', cx: 40.7, cy: 82 },
  salvador: { label: 'salvador', cx: 38, cy: 75.4 },
  recife: { label: 'recife', cx: 45.2, cy: 74.3 },
  'joao-pessoa': { label: 'joão pessoa', cx: 48.1, cy: 69.6 },
  natal: { label: 'natal', cx: 48.1, cy: 68.7 },
  atins: { label: 'atins', cx: 47.8, cy: 67.4 },
  'chapada-dos-veadeiros': { label: 'chapada dos veadeiros', cx: 41.8, cy: 64.4 },
  'buenos-aires': { label: 'buenos aires', cx: 29.3, cy: 94.9 },
  havana: { label: 'havana', cx: 10.1, cy: 39.9 },
  cancun: { label: 'cancún', cx: 6.5, cy: 41.8 },
  'washington-dc': { label: 'washington dc', cx: 14.4, cy: 24.9 },
  'new-york': { label: 'new york', cx: 16.8, cy: 23.1 },
  estonia: { label: 'estônia', cx: 95.8, cy: 5.3, next: true },
};

export const ROOT: PlaceId = 'rio';

export const EDGES =
  'M41.4 83.7 L40.7 82 M41.4 83.7 L38 75.4 M41.4 83.7 L45.2 74.3 L48.1 69.6 L48.1 68.7 L47.8 67.4 L41.8 64.4 M41.4 83.7 L29.3 94.9 M41.4 83.7 L10.1 39.9 L6.5 41.8 M10.1 39.9 L14.4 24.9 L16.8 23.1';
export const EDGE_NEXT = 'M16.8 23.1 Q60 -6 95.8 5.3';
```

- [ ] **Step 4: Run tests — expect pass**, then **commit**

```bash
npx vitest run src/map
git add src/map
git commit -m "feat: os 14 lugares do mapa, coordenadas e arestas verbatim do handoff"
```

---

### Task 5: Diary content collection + placeholder entries

**Files:**
- Create: `src/content/schema.ts`, `src/content.config.ts`, `src/content/diario/pt/chegando-no-rio.md`, `src/content/diario/pt/atins-vento.md`, `src/content/diario/pt/uma-ideia-de-site.md`, `src/content/diario/en/a-site-idea.md`
- Create: `src/content/entries.ts` (query helpers)
- Test: `src/content/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: `PLACE_IDS`, `PlaceId` from `src/map/places.ts`; `Locale` from i18n.
- Produces:
  - `entrySchema` (zod) — testable without Astro virtuals
  - From `entries.ts`: `type DiaryEntry = { locale: Locale; slug: string; data: EntryData; body-render fn via Astro }`, `listEntries(locale): Promise<DiaryEntry[]>` (newest-first; pt fills gaps for other locales, marked `fromPt: boolean`), `countByPlace(): Promise<Record<PlaceId, number>>`, `latestEntry(locale)`

- [ ] **Step 1: Write the failing schema test**

`src/content/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { entrySchema } from '../schema';

const valid = { title: 'chegando no rio', date: '2026-09-04', place: 'rio' };

describe('schema do diário', () => {
  it('aceita entrada mínima válida', () => {
    expect(entrySchema.safeParse(valid).success).toBe(true);
  });
  it('rejeita lugar fora do mapa', () => {
    expect(entrySchema.safeParse({ ...valid, place: 'paris' }).success).toBe(false);
  });
  it('rejeita foto sem alt', () => {
    const r = entrySchema.safeParse({ ...valid, media: { type: 'photo' } });
    expect(r.success).toBe(false);
  });
  it('aceita foto placeholder (sem src) com alt', () => {
    const r = entrySchema.safeParse({ ...valid, media: { type: 'photo', alt: 'praia do leme ao amanhecer' } });
    expect(r.success).toBe(true);
  });
  it('rejeita galeria vazia e galeria com item sem alt', () => {
    expect(entrySchema.safeParse({ ...valid, media: { type: 'gallery', items: [] } }).success).toBe(false);
    expect(entrySchema.safeParse({ ...valid, media: { type: 'gallery', items: [{ src: 'x.jpg' }] } }).success).toBe(false);
  });
  it('aceita vídeo com url e alt', () => {
    const r = entrySchema.safeParse({
      ...valid,
      media: { type: 'video', url: 'https://www.youtube.com/watch?v=abc', alt: 'vlog de atins' },
    });
    expect(r.success).toBe(true);
  });
  it('coage a data para Date', () => {
    const r = entrySchema.parse(valid);
    expect(r.date).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/content` → FAIL.

- [ ] **Step 3: Implement schema + collection**

`src/content/schema.ts`:

```ts
import { z } from 'astro/zod';
import { PLACE_IDS } from '../map/places';

const photo = z.object({ type: z.literal('photo'), src: z.string().optional(), alt: z.string().min(1) });
const gallery = z.object({
  type: z.literal('gallery'),
  items: z.array(z.object({ src: z.string().optional(), alt: z.string().min(1), video: z.boolean().optional() })).min(1),
});
const video = z.object({ type: z.literal('video'), url: z.string().url(), alt: z.string().min(1) });

export const entrySchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  place: z.enum(PLACE_IDS),
  media: z.discriminatedUnion('type', [photo, gallery, video]).optional(),
});
export type EntryData = z.infer<typeof entrySchema>;
```

`src/content.config.ts` (Astro 5 content-layer; doc: docs.astro.build/en/guides/content-collections/):

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { entrySchema } from './content/schema';

const diario = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/diario' }),
  schema: entrySchema,
});

export const collections = { diario };
```

`src/content/entries.ts`:

```ts
import { getCollection, render, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n';
import type { PlaceId } from '../map/places';
import { PLACE_IDS } from '../map/places';

export interface DiaryEntry {
  entry: CollectionEntry<'diario'>;
  locale: Locale;      // locale the content is written in
  slug: string;        // without locale prefix
  fromPt: boolean;     // true when shown on a non-pt list as untranslated
}

function split(e: CollectionEntry<'diario'>): { locale: Locale; slug: string } {
  const [locale, ...rest] = e.id.split('/');
  return { locale: locale as Locale, slug: rest.join('/').replace(/\.md$/, '') };
}

export async function listEntries(displayLocale: Locale): Promise<DiaryEntry[]> {
  const all = (await getCollection('diario')).map((entry) => ({ entry, ...split(entry) }));
  const inLocale = all.filter((e) => e.locale === displayLocale);
  const slugsInLocale = new Set(inLocale.map((e) => e.slug));
  const ptGapFill =
    displayLocale === 'pt' ? [] : all.filter((e) => e.locale === 'pt' && !slugsInLocale.has(e.slug));
  return [...inLocale.map((e) => ({ ...e, fromPt: false })), ...ptGapFill.map((e) => ({ ...e, fromPt: true }))]
    .sort((a, b) => b.entry.data.date.getTime() - a.entry.data.date.getTime());
}

export async function latestEntry(locale: Locale): Promise<DiaryEntry | undefined> {
  return (await listEntries(locale))[0];
}

export async function countByPlace(): Promise<Record<PlaceId, number>> {
  const pt = (await getCollection('diario')).map((e) => ({ e, ...split(e) })).filter((x) => x.locale === 'pt');
  const counts = Object.fromEntries(PLACE_IDS.map((id) => [id, 0])) as Record<PlaceId, number>;
  for (const { e } of pt) counts[e.data.place] += 1;
  return counts;
}

export { render };
```

(`entries.ts` imports `astro:content`, so it is exercised by the build + Playwright, not Vitest — the pure logic worth unit-testing lives in the schema.)

- [ ] **Step 4: Write the placeholder entries** — clearly marked as placeholders, wired to different media types and places:

`src/content/diario/pt/chegando-no-rio.md`:

```markdown
---
title: "chegando no rio (post de exemplo)"
date: 2026-09-04
place: rio
media:
  type: photo
  alt: "placeholder: o mar do leme no fim da tarde"
---

este é um post de exemplo para segurar o layout. o texto de verdade vem depois —
por enquanto ele só precisa ter duas ou três frases pra card e página de entrada
terem corpo.
```

`src/content/diario/pt/atins-vento.md`:

```markdown
---
title: "o vento de atins (post de exemplo)"
date: 2026-08-18
place: atins
media:
  type: gallery
  items:
    - alt: "placeholder: dunas ao amanhecer"
    - alt: "placeholder: a vila de atins"
    - alt: "placeholder: kite no fim da tarde"
      video: true
---

post de exemplo com galeria de três quadrados, o terceiro com o disco de play,
como no artboard 1c.
```

`src/content/diario/pt/uma-ideia-de-site.md`:

```markdown
---
title: "uma ideia de site (post de exemplo)"
date: 2026-07-02
place: chapada-dos-veadeiros
---

post de exemplo sem mídia — só texto, pra variante de card mais simples.
```

`src/content/diario/en/a-site-idea.md` (proves per-locale content + gap-fill):

```markdown
---
title: "a site idea (sample post)"
date: 2026-07-02
place: chapada-dos-veadeiros
---

sample text-only post in english, translating "uma ideia de site".
```

Note: slugs differ across locales on purpose (`uma-ideia-de-site` vs `a-site-idea`) — gap-fill matches by slug, so the en list will show this en post **plus** the two untranslated pt posts. That is the intended §5 behavior.

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run src/content && npm run build`
Expected: tests pass; build succeeds (collection parses). Then temporarily break one entry (`place: paris`), run `npm run build`, confirm the build **fails** with a zod error, revert.

- [ ] **Step 6: Commit**

```bash
git add src/content src/content.config.ts
git commit -m "feat: coleção do diário com schema estrito e posts de exemplo"
```

---

### Task 6: Base layout + header

**Files:**
- Create: `src/layouts/BaseLayout.astro`, `src/components/Header.astro`, `src/components/SoundButton.astro`
- Modify: `src/pages/index.astro` (use the layout)

**Interfaces:**
- Consumes: `getStrings`, `localeUrl`, `htmlLang`, `LOCALES`, tokens/base css.
- Produces: `BaseLayout` props `{ locale: Locale; title: string; description?: string; path: string; fieldAnchor: 'home' | 'diario' }`. `path` is the locale-less path of the current page ('/', '/diario/', `/diario/<slug>/`) used for hreflang + the language control. Slot `main` content lands inside `<main id="conteudo">`.

- [ ] **Step 1: Write `BaseLayout.astro`**

```astro
---
import { LOCALES, getStrings, htmlLang, localeUrl, type Locale } from '../i18n';
import '../styles/tokens.css';
import '../styles/base.css';
import { ClientRouter } from 'astro:transitions';

interface Props {
  locale: Locale;
  title: string;
  description?: string;
  path: string;
  fieldAnchor: 'home' | 'diario';
}
const { locale, title, description, path, fieldAnchor } = Astro.props;
const t = getStrings(locale);
---
<html lang={htmlLang(locale)}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    <link rel="icon" href={`${import.meta.env.BASE_URL}favicon.svg`} type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&display=swap" rel="stylesheet" />
    {LOCALES.map((l) => (
      <link rel="alternate" hreflang={htmlLang(l)} href={new URL(localeUrl(l, path), Astro.site).href} />
    ))}
    <ClientRouter />
  </head>
  <body data-field-anchor={fieldAnchor}>
    <a class="skip-link" href="#conteudo">{t.skipLink}</a>
    <div class="field-css" aria-hidden="true"></div>
    <div class="halftone-overlay" aria-hidden="true"></div>
    <Header locale={locale} path={path} />
    <main id="conteudo">
      <slot />
    </main>
  </body>
</html>
<style is:global>
  body[data-field-anchor='home'] { --field-x: 80%; --field-y: 85%; }
  body[data-field-anchor='diario'] { --field-x: 15%; --field-y: 40%; }
</style>
```

Add `import Header from '../components/Header.astro';` to the frontmatter.

- [ ] **Step 2: Write `Header.astro`** — glass pill per README 1a/1b:

```astro
---
import { LOCALES, getStrings, localeUrl, type Locale } from '../i18n';
import SoundButton from './SoundButton.astro';

interface Props { locale: Locale; path: string }
const { locale, path } = Astro.props;
const t = getStrings(locale);
const isDiario = path.startsWith('/diario');
---
<header class="glass site-header">
  <a class="brand" href={localeUrl(locale, '/')}>{t.brand}</a>
  <nav class="desktop-nav" aria-label="principal">
    <a href={localeUrl(locale, '/')} aria-current={!isDiario ? 'page' : undefined}>{t.navHome}</a>
    <a href={localeUrl(locale, '/diario/')} aria-current={isDiario ? 'page' : undefined}>{t.navDiario}</a>
  </nav>
  <div class="header-right">
    <nav class="lang-seg" aria-label="idioma">
      {LOCALES.map((l) => (
        <a
          href={localeUrl(l, path)}
          aria-current={l === locale ? 'true' : undefined}
          data-lang={l}
        >{{ pt: 'pt', en: 'en', fr: 'fr', es: 'es', zh: '中', ja: '日' }[l]}</a>
      ))}
    </nav>
    <SoundButton locale={locale} />
  </div>
</header>
<script>
  document.querySelectorAll<HTMLAnchorElement>('.lang-seg a').forEach((a) =>
    a.addEventListener('click', () => {
      try { localStorage.setItem('lang', a.dataset.lang ?? 'pt'); } catch { /* storage indisponível: preferência só não persiste */ }
    }),
  );
</script>
<style>
  .site-header {
    display: flex; align-items: center; justify-content: space-between;
    border-radius: var(--radius-pill);
    padding: 10px 6px 10px 14px; margin-top: 14px;
  }
  .brand { font-weight: 600; font-size: 17px; white-space: nowrap; color: var(--color-text); }
  .desktop-nav { display: none; }
  .header-right { display: flex; align-items: center; gap: 8px; }
  .lang-seg {
    display: flex; gap: 2px; padding: 2px;
    background: rgba(255,255,255,.4); border: 1px solid rgba(255,255,255,.72);
    border-radius: var(--radius-pill);
  }
  .lang-seg a {
    font-size: 11px; line-height: 24px; min-width: 26px; text-align: center;
    color: var(--lb-700); border-radius: var(--radius-pill);
  }
  .lang-seg a[aria-current='true'] { background: var(--lb); color: #fff; }
  @media (min-width: 1024px) {
    .site-header { padding: 8px 10px 8px 20px; }
    .desktop-nav { display: flex; gap: 28px; font-size: 15px; }
    .desktop-nav a[aria-current='page'] { color: var(--color-text); }
    .header-right { gap: 10px; }
    .lang-seg a { font-size: 12px; min-width: 32px; }
  }
</style>
```

- [ ] **Step 3: Write `SoundButton.astro`** — markup + bars only (engine wires in Task 11):

```astro
---
import { getStrings, type Locale } from '../i18n';
interface Props { locale: Locale }
const t = getStrings(Astro.props.locale);
---
<button
  id="sound-toggle"
  type="button"
  aria-label={t.soundPaused}
  data-label-playing={t.soundPlaying}
  data-label-paused={t.soundPaused}
  data-state="paused"
>
  <span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
</button>
<style>
  button {
    width: 44px; height: 44px; display: grid; place-items: center;
    background: none; border: none; cursor: pointer; border-radius: var(--radius-pill);
  }
  .bars { display: flex; gap: 3px; align-items: center; height: 12px; }
  .bars i { width: 2px; height: 12px; background: var(--lb); transform: scaleY(0.6); }
  button[data-state='playing'] .bars i { animation: bounce 1.1s ease-in-out infinite; }
  button[data-state='playing'] .bars i:nth-child(1) { animation-delay: 0s; }
  button[data-state='playing'] .bars i:nth-child(2) { animation-delay: .2s; }
  button[data-state='playing'] .bars i:nth-child(3) { animation-delay: .4s; }
  button[data-state='playing'] .bars i:nth-child(4) { animation-delay: .1s; }
  @keyframes bounce { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) {
    button[data-state='playing'] .bars i { animation: none; transform: scaleY(0.6); }
  }
</style>
```

- [ ] **Step 4: Point `index.astro` at the layout** (temporary body; real home in Task 7):

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout locale="pt" title="nicholas ferrer" path="/" fieldAnchor="home">
  <h1>nicholas ferrer</h1>
</BaseLayout>
```

- [ ] **Step 5: Verify in browser**

Run: `npm run dev` → open `http://localhost:4321/portfolio/`.
Check: glass header pill over the blue CSS field, halftone dots visible, skip link appears on first Tab, language pills render with pt highlighted, sound button shows static bars. Compare the header against `design-reference/Portfolio nico fada.dc.html` opened in another tab.

- [ ] **Step 6: Commit**

```bash
git add src/layouts src/components src/pages/index.astro
git commit -m "feat: layout base com campo css, cabeçalho de vidro e controle de idioma"
```

---

### Task 7: Home page (mobile + desktop) with the SVG map

**Files:**
- Create: `src/components/MapSvg.astro`, `src/components/HomePage.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `PLACES`, `PLACE_IDS`, `EDGES`, `EDGE_NEXT`, `ROOT`; `countByPlace`, `latestEntry`; `getStrings`, `localeUrl`, `formatDayMonth`.
- Produces: `HomePage.astro` with prop `{ locale: Locale }` — Task 9 reuses it for locale-prefixed routes. `MapSvg.astro` props `{ locale: Locale; counts: Record<PlaceId, number>; variant: 'mobile' | 'desktop' }` (variant only changes label size class).

- [ ] **Step 1: Write `MapSvg.astro`**

Nodes are **SVG `<a>` links** (spec §8) to the filtered diário. Invisible hit circles: at 390px render width, 100 viewBox units ≈ 350px, so r=6.5 units ≈ 45px diameter — meets the ≥44px target.

```astro
---
import { getStrings, localeUrl, type Locale } from '../i18n';
import { EDGES, EDGE_NEXT, PLACES, PLACE_IDS, ROOT, type PlaceId } from '../map/places';

interface Props { locale: Locale; counts: Record<PlaceId, number>; variant: 'mobile' | 'desktop' }
const { locale, counts, variant } = Astro.props;
const t = getStrings(locale);
---
<svg viewBox="0 0 100 100" width="100%" role="group" aria-label={t.mapKicker} class={variant} data-map>
  <path d={EDGES} fill="none" stroke="var(--lb-700)" stroke-width="0.5" opacity="0.55" />
  <path d={EDGE_NEXT} fill="none" stroke="var(--lb-700)" stroke-width="0.5" opacity="0.55" stroke-dasharray="1.5 1.5" />
  {PLACE_IDS.map((id) => {
    const p = PLACES[id];
    return (
      <a href={`${localeUrl(locale, '/diario/')}?lugar=${id}`} aria-label={t.nodeAriaLabel(p.label, counts[id])} data-node={id}>
        {id === ROOT && <circle cx={p.cx} cy={p.cy} r="4.2" fill="var(--lb)" opacity="0.18" />}
        <circle
          cx={p.cx} cy={p.cy}
          r={id === ROOT ? 2.4 : 1.5}
          fill={p.next ? '#fff' : 'var(--lb)'}
          stroke={p.next ? 'var(--lb)' : '#fff'}
          stroke-width="1.2"
          stroke-dasharray={p.next ? '1.6 1.2' : undefined}
          class="dot"
        />
        <circle cx={p.cx} cy={p.cy} r="6.5" fill="transparent" class="hit" />
        <text x={p.cx + 2.8} y={p.cy + 1} class="label">{p.label}</text>
      </a>
    );
  })}
</svg>
<style>
  a { outline-offset: 2px; }
  a:hover .dot, a:focus-visible .dot { filter: brightness(1.15); }
  .label { font-style: italic; font-size: 3.3px; fill: var(--color-text); }
  svg.desktop .label { font-size: 2.6px; }
  svg.desktop [data-node] .dot { r: 1.3; }
</style>
```

Label placement note: the README gives node coordinates but not label offsets; `x = cx + 2.8, y = cy + 1` is the default. Step 4's visual pass against the mock adjusts individual crowded labels (natal/joão pessoa/atins cluster) by adding an optional `labelDx/labelDy` to `Place` in `src/map/places.ts` — keep the coordinate test untouched.

- [ ] **Step 2: Write `HomePage.astro`** — full page per README 1a (mobile) / 1b (desktop). Structure and the exact values:

```astro
---
import { formatDayMonth, getStrings, localeUrl, type Locale } from '../i18n';
import { countByPlace, latestEntry } from '../content/entries';
import { PLACE_IDS } from '../map/places';
import MapSvg from './MapSvg.astro';

interface Props { locale: Locale }
const { locale } = Astro.props;
const t = getStrings(locale);
const counts = await countByPlace();
const latest = await latestEntry(locale);
const [footerPre, footerPost] = t.footerExperiment.split('{github}');
---
<div class="home">
  <div class="col-left">
    <h1>{t.h1Lines[0]}<br />{t.h1Lines[1]}</h1>
    {t.bio.map((p) => <p class="bio">{p}</p>)}

    <section class="convite">
      <p class="kicker">{t.conviteKicker}</p>
      <p class="convite-intro">{t.conviteIntro}</p>
      <ul class="convite-links">
        {t.links.map((l) => (
          <li><a href={l.href} rel="me"><b>{l.label}</b><span>{l.note}</span></a></li>
        ))}
      </ul>
    </section>

    <a class="glass diario-cta" href={localeUrl(locale, '/diario/')}>
      <span class="cta-title">{t.diarioCta}</span>
      {latest && <span class="cta-latest">{t.diarioLast(formatDayMonth(latest.entry.data.date, locale))}</span>}
    </a>

    <footer>
      <p>{footerPre}<a class="footer-gh" href="https://github.com/heisenico/portfolio">github</a>{footerPost}</p>
      <p class="footer-sound"><i>{t.footerSound}</i></p>
    </footer>
  </div>

  <figure class="glass map-figure" data-tilt>
    <figcaption class="map-head">
      <span class="kicker">{t.mapKicker}</span>
      <span class="map-count">{t.mapCountLine(PLACE_IDS.length - 1)}</span>
    </figcaption>
    <MapSvg locale={locale} counts={counts} variant="mobile" />
    <p class="map-caption">
      <span>{t.mapCaptionMobile}</span>
      <span class="caption-desktop-a">{t.mapCaptionDesktopA}</span>
      <span class="caption-desktop-b">{t.mapCaptionDesktopB}</span>
    </p>
  </figure>
</div>
```

And the scoped style block, values from README 1a/1b:

```css
.home { padding: 0 20px 28px; }
h1 { font-weight: 600; font-size: 54px; line-height: 1.05; letter-spacing: -0.02em; margin-top: 56px; }
.bio { font-size: 16px; line-height: 26px; color: color-mix(in srgb, var(--color-text) 82%, transparent); margin-top: 14px; }
.bio:first-of-type { margin-top: 22px; }
.kicker { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: color-mix(in srgb, var(--color-text) 70%, transparent); }
.convite { margin-top: 44px; }
.convite-intro { font-style: italic; margin-top: 6px; }
.convite-links { list-style: none; padding: 0; }
.convite-links a { display: flex; align-items: baseline; gap: 12px; padding: 10px 0; font-size: 16px; line-height: 26px; }
.convite-links b { color: var(--lb-700); min-width: 88px; font-weight: 700; }
.convite-links span { font-size: 14.5px; color: color-mix(in srgb, var(--color-text) 70%, transparent); }
.diario-cta { display: flex; justify-content: space-between; align-items: center; margin-top: 40px; padding: 16px 18px; }
.cta-title { font-weight: 600; font-size: 18px; color: var(--color-text); }
.cta-latest { color: var(--lb-700); font-size: 14px; }
footer { margin-top: 40px; font-size: 13px; line-height: 21px; color: color-mix(in srgb, var(--color-text) 70%, transparent); }
.footer-gh { text-decoration: underline; }
.footer-sound { margin-top: 12px; }
.map-figure { margin-top: 44px; padding: 18px 18px 14px; }
.map-head { display: flex; justify-content: space-between; align-items: baseline; }
.map-count, .caption-desktop-a, .caption-desktop-b { display: none; }
.map-caption { font-size: 13px; line-height: 20px; color: color-mix(in srgb, var(--color-text) 70%, transparent); margin-top: 8px; }

@media (min-width: 1024px) {
  .home { display: grid; grid-template-columns: 5fr 7fr; column-gap: 64px; padding: 0 56px 48px; }
  .col-left { max-width: 52ch; padding-top: 96px; }
  h1 { font-size: 88px; margin-left: -0.035em; margin-top: 0; }
  .bio { font-size: 17px; line-height: 28px; }
  .bio:first-of-type { margin-top: 36px; }
  .convite-links { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; }
  .convite-links a { flex-direction: column; align-items: flex-start; gap: 2px; }
  footer { margin-top: 56px; }
  .map-figure { padding: 24px 28px 20px; margin-top: 72px; position: sticky; top: 24px; }
  .map-count { display: inline; font-size: 13px; color: var(--lb-700); }
  .map-caption > span:first-child { display: none; }
  .map-caption { display: flex; justify-content: space-between; }
  .caption-desktop-a, .caption-desktop-b { display: inline; }
}
```

(Header spans the page above `.home`; on desktop the README puts header inside the grid spanning both columns — since our header sits in `BaseLayout` above `<main>`, give it the same horizontal padding: add `.site-header { margin-inline: 20px; } @media (min-width:1024px){ .site-header { margin-inline: 56px; margin-top: 24px; } }` to `base.css`.)

- [ ] **Step 3: Replace `index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import HomePage from '../components/HomePage.astro';
import { getStrings } from '../i18n';
const t = getStrings('pt');
---
<BaseLayout locale="pt" title={t.brand} description={t.bio[0]} path="/" fieldAnchor="home">
  <HomePage locale="pt" />
</BaseLayout>
```

- [ ] **Step 4: Visual verification against the mock**

Run `npm run dev`; open the mock `design-reference/Portfolio nico fada.dc.html` beside it.
- 390px viewport vs artboard 1a: H1 two lines at 54px, bio spacing, map card, convite rows, CTA, footer.
- 1280px vs artboard 1b: 5fr/7fr grid, H1 88px, sticky map with count line, 2-col convite.
- Keyboard: Tab reaches skip link → header links → every map node (focus ring visible) → convite links.
- Adjust crowded map labels via `labelDx/labelDy` as described in Step 1.

- [ ] **Step 5: Run all tests + build, commit**

```bash
npx vitest run && npm run build
git add -A
git commit -m "feat: a home inteira — bio, convite, cta do diário e o mapa svg acessível"
```

---

### Task 8: Diário — list page, entry page, place filter

**Files:**
- Create: `src/components/DiarioList.astro`, `src/components/EntryCard.astro`, `src/components/MediaBlock.astro`, `src/components/EntryPage.astro`, `src/pages/diario/index.astro`, `src/pages/diario/[slug].astro`

**Interfaces:**
- Consumes: `listEntries`, `render`, `DiaryEntry`; strings; `PLACES` for labels.
- Produces: `DiarioList.astro` prop `{ locale: Locale }`; `EntryPage.astro` props `{ locale: Locale; item: DiaryEntry; all: DiaryEntry[] }` — Task 9 reuses both.

- [ ] **Step 1: Write `MediaBlock.astro`** — photo / gallery / video, placeholder gradient when `src` missing:

```astro
---
import type { EntryData } from '../content/schema';
interface Props { media: NonNullable<EntryData['media']>; ratio?: string }
const { media, ratio = '4 / 3' } = Astro.props;
---
{media.type === 'photo' && (
  media.src
    ? <img src={media.src} alt={media.alt} style={`aspect-ratio:${ratio}`} />
    : <div class="ph" role="img" aria-label={media.alt} style={`aspect-ratio:${ratio}`}></div>
)}
{media.type === 'gallery' && (
  <div class="gallery">
    {media.items.map((it) => (
      <div class="thumb">
        {it.src
          ? <img src={it.src} alt={it.alt} />
          : <div class="ph square" role="img" aria-label={it.alt}></div>}
        {it.video && <span class="play" aria-hidden="true">▶</span>}
      </div>
    ))}
  </div>
)}
{media.type === 'video' && (
  <a class="video" href={media.url} aria-label={media.alt}>
    <div class="ph" style={`aspect-ratio:${ratio}`}></div>
    <span class="play" aria-hidden="true">▶</span>
  </a>
)}
<style>
  img, .ph { width: 100%; display: block; object-fit: cover; }
  .ph {
    background: linear-gradient(135deg, var(--lb-200), var(--lb-400));
    background-image: radial-gradient(circle, rgba(14,23,80,.18) 30%, transparent 32%), linear-gradient(135deg, var(--lb-200), var(--lb-400));
    background-size: 3px 3px, cover;
    background-blend-mode: multiply, normal;
  }
  .gallery { display: flex; gap: 8px; }
  .thumb { position: relative; flex: 1; border-radius: var(--radius-thumb); overflow: hidden; }
  .ph.square { aspect-ratio: 1; }
  .play {
    position: absolute; inset: 0; margin: auto; width: 36px; height: 36px;
    display: grid; place-items: center; border-radius: 50%;
    background: rgba(255,255,255,.85); color: var(--lb); font-size: 12px;
  }
</style>
```

- [ ] **Step 2: Write `EntryCard.astro`** — glass card per artboard 1c:

```astro
---
import { formatEntryDate, getStrings, localeUrl, type Locale } from '../i18n';
import { PLACES } from '../map/places';
import type { DiaryEntry } from '../content/entries';
import MediaBlock from './MediaBlock.astro';

interface Props { locale: Locale; item: DiaryEntry; excerpt: string }
const { locale, item, excerpt } = Astro.props;
const t = getStrings(locale);
const { data } = item.entry;
---
<article class="glass card" data-place={data.place}>
  {data.media?.type === 'photo' && <MediaBlock media={data.media} />}
  <div class="body">
    <p class="meta">
      <span>{formatEntryDate(data.date, locale)} · {PLACES[data.place].label}</span>
      <span class="meta-right">
        {item.fromPt && <span class="tag-pt">{t.inPortuguese}</span>}
        <span class="node-ref">nó: {PLACES[data.place].label.split(' ')[0]}</span>
      </span>
    </p>
    <h2><a href={localeUrl(locale, `/diario/${item.slug}/`)}>{data.title}</a></h2>
    {data.media && data.media.type !== 'photo' && <div class="media-inline"><MediaBlock media={data.media} /></div>}
    <p class="excerpt">{excerpt}</p>
  </div>
</article>
<style>
  .body { padding: 16px 18px 18px; }
  .meta { display: flex; justify-content: space-between; font-size: 12.5px; color: color-mix(in srgb, var(--color-text) 70%, transparent); }
  .meta-right { display: flex; gap: 8px; }
  .node-ref { color: var(--lb-700); }
  .tag-pt { color: var(--lb-700); border: 1px solid var(--lb-300); border-radius: var(--radius-pill); padding: 0 8px; }
  h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin-top: 8px; }
  h2 a { color: var(--color-text); }
  .media-inline { margin-top: 12px; }
  .excerpt { font-size: 15px; line-height: 24px; margin-top: 8px; }
</style>
```

- [ ] **Step 3: Write `DiarioList.astro`** with the filter chip:

```astro
---
import { getStrings, localeUrl, type Locale } from '../i18n';
import { listEntries } from '../content/entries';
import { PLACES, PLACE_IDS } from '../map/places';

interface Props { locale: Locale }
const { locale } = Astro.props;
const t = getStrings(locale);
const entries = await listEntries(locale);
const excerpts = new Map(entries.map((e) => [e.slug, (e.entry.body ?? '').split('\n').find((l) => l.trim()) ?? '']));
const placeLabels = JSON.stringify(Object.fromEntries(PLACE_IDS.map((id) => [id, PLACES[id].label])));
const [introPre, introPost] = t.diarioIntro.split('{youtube}');
---
<div class="diario">
  <p class="kicker">{t.diarioKicker}</p>
  <h1>{t.diarioH1}</h1>
  <p class="intro">{introPre}<a href="https://www.youtube.com/@heisenico">youtube</a>{introPost}</p>
  <p class="filter-chip glass" data-chip hidden>
    <span data-chip-text></span>
    <button type="button" data-chip-clear>{t.filterClear}</button>
  </p>
  <div class="entries" data-entries data-showing-tpl={t.filterShowing('%s')} data-places={placeLabels}>
    {entries.map((e) => (
      <EntryCard locale={locale} item={e} excerpt={excerpts.get(e.slug) ?? ''} />
    ))}
  </div>
</div>
<script>
  const chip = document.querySelector<HTMLElement>('[data-chip]');
  const wrap = document.querySelector<HTMLElement>('[data-entries]');
  const lugar = new URLSearchParams(location.search).get('lugar');
  if (chip && wrap && lugar) {
    const labels = JSON.parse(wrap.dataset.places ?? '{}') as Record<string, string>;
    if (labels[lugar]) {
      wrap.querySelectorAll<HTMLElement>('[data-place]').forEach((card) => {
        card.hidden = card.dataset.place !== lugar;
      });
      chip.hidden = false;
      chip.querySelector('[data-chip-text]')!.textContent =
        (wrap.dataset.showingTpl ?? '%s').replace('%s', labels[lugar]);
      chip.querySelector('[data-chip-clear]')!.addEventListener('click', () => {
        location.search = '';
      });
    }
  }
</script>
```

Style block (artboard 1c): `.diario { padding: 0 20px 28px; } h1 { font-size: 40px; margin-top: 8px; } .kicker { margin-top: 48px; } .intro { font-size: 15px; line-height: 24px; margin-top: 10px; } .entries { display: flex; flex-direction: column; gap: 20px; margin-top: 36px; } .filter-chip { display: inline-flex; gap: 10px; padding: 6px 14px; margin-top: 16px; border-radius: var(--radius-pill); font-size: 13px; } .filter-chip button { background: none; border: none; color: var(--lb-700); cursor: pointer; font: inherit; }` — plus desktop `@media (min-width:1024px) { .diario { padding: 0 56px 56px; max-width: 900px; } }`.

Decision (YAGNI, noted in spec review): the mock's "mais antigas ↓" pagination link is omitted — the list shows all entries until real volume demands paging.

- [ ] **Step 4: Write `EntryPage.astro`** (artboard 1d) and the two route files:

```astro
---
import { formatEntryDate, getStrings, localeUrl, type Locale } from '../i18n';
import { PLACES } from '../map/places';
import { render, type DiaryEntry } from '../content/entries';
import MediaBlock from './MediaBlock.astro';

interface Props { locale: Locale; item: DiaryEntry; all: DiaryEntry[] }
const { locale, item, all } = Astro.props;
const t = getStrings(locale);
const { data } = item.entry;
const { Content } = await render(item.entry);
---
<div class="entry-grid">
  <aside>
    <p class="kicker">{t.diarioKicker}</p>
    <h1>{t.diarioH1}</h1>
    <nav class="entry-nav" aria-label={t.diarioKicker}>
      {all.map((e) => (
        <a href={localeUrl(locale, `/diario/${e.slug}/`)} aria-current={e.slug === item.slug ? 'page' : undefined}>
          <span class="nav-meta">{formatEntryDate(e.entry.data.date, locale)} · {PLACES[e.entry.data.place].label}</span>
          <span class="nav-title">{e.entry.data.title}</span>
        </a>
      ))}
    </nav>
  </aside>
  <article class="glass">
    {data.media?.type === 'photo' && <MediaBlock media={data.media} ratio="16 / 9" />}
    <div class="body">
      <p class="meta">
        <span>{formatEntryDate(data.date, locale)} · {PLACES[data.place].label}</span>
        <a href={`${localeUrl(locale, '/')}#mapa`}>{t.seeOnMap}</a>
      </p>
      <h2>{data.title}</h2>
      {data.media && data.media.type !== 'photo' && <MediaBlock media={data.media} />}
      <div class="prose"><Content /></div>
    </div>
  </article>
</div>
```

Style: mobile single column (aside nav collapses to a simple list under the article or above it — mobile shows article first); desktop `@media (min-width:1024px) { .entry-grid { display: grid; grid-template-columns: 300px 1fr; gap: 72px; margin-top: 72px; padding: 0 56px 56px; } }`; aside h1 34px; nav items `padding: 12px 0; .nav-meta { font-size: 12.5px; color: 70%; display:block; }`; current item `a[aria-current] { padding: 12px 14px; margin: 0 -14px; background: rgba(255,255,255,.52); border: 1px solid rgba(255,255,255,.72); border-radius: var(--radius-nav); } .nav-title { font-weight: 600; }`; article `max-width: 760px;` body `padding: 28px 36px 36px;` h2 `36px; letter-spacing: -0.015em;` prose `font-size: 17px; line-height: 28px; max-width: 58ch;` blockquote `font-style: italic; font-size: 22px; line-height: 32px; color: var(--lb-900); max-width: 34ch; margin-top: 28px;`. Give the home map figure `id="mapa"` in Task 7's `HomePage.astro` (`<figure id="mapa" …>`) so `#mapa` resolves.

`src/pages/diario/index.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import DiarioList from '../../components/DiarioList.astro';
import { getStrings } from '../../i18n';
const t = getStrings('pt');
---
<BaseLayout locale="pt" title={`${t.diarioCta} — ${t.brand}`} path="/diario/" fieldAnchor="diario">
  <DiarioList locale="pt" />
</BaseLayout>
```

`src/pages/diario/[slug].astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import EntryPage from '../../components/EntryPage.astro';
import { listEntries } from '../../content/entries';
import { getStrings } from '../../i18n';

export async function getStaticPaths() {
  const all = await listEntries('pt');
  return all.map((item) => ({ params: { slug: item.slug }, props: { item, all } }));
}
const { item, all } = Astro.props;
const t = getStrings('pt');
---
<BaseLayout locale="pt" title={`${item.entry.data.title} — ${t.brand}`} path={`/diario/${item.slug}/`} fieldAnchor="diario">
  <EntryPage locale="pt" item={item} all={all} />
</BaseLayout>
```

- [ ] **Step 5: Verify in browser**

`npm run dev`: `/portfolio/diario/` shows 3 cards (photo, gallery-with-play, text-only) newest first; `?lugar=atins` filters to one card with the chip; "limpar" restores; `/portfolio/diario/chegando-no-rio/` renders the 1d layout; with JS disabled (DevTools) the list is unfiltered but complete. Compare both against artboards 1c/1d.

- [ ] **Step 6: Build + commit**

```bash
npx vitest run && npm run build
git add -A
git commit -m "feat: diário — lista com filtro por lugar e página de entrada"
```

---

### Task 9: Locale-prefixed routes

**Files:**
- Create: `src/pages/[lang]/index.astro`, `src/pages/[lang]/diario/index.astro`, `src/pages/[lang]/diario/[slug].astro`

**Interfaces:**
- Consumes: `HomePage`, `DiarioList`, `EntryPage`, `listEntries`, `getStrings`, `isTranslated`, `LOCALES`.
- Produces: `/en/`, `/fr/`, `/es/`, `/zh/`, `/ja/` versions of every page. fr/es/zh/ja render English strings (our fallback chain — refines the spec's "Astro rewrite" mechanism, which would have served pt; decided in planning, same URLs and behavior as spec §2/§4 intend).

- [ ] **Step 1: Write the three route files**

`src/pages/[lang]/index.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import HomePage from '../../components/HomePage.astro';
import { LOCALES, getStrings, isTranslated, type Locale } from '../../i18n';

export function getStaticPaths() {
  return LOCALES.filter((l) => l !== 'pt').map((lang) => ({ params: { lang } }));
}
const locale = Astro.params.lang as Locale;
const t = getStrings(locale);
---
<BaseLayout locale={locale} title={t.brand} description={t.bio[0]} path="/" fieldAnchor="home">
  {!isTranslated(locale) && <p class="fallback-note"><i>{t.notTranslated}</i></p>}
  <HomePage locale={locale} />
</BaseLayout>
<style>
  .fallback-note { padding: 12px 20px 0; font-size: 13px; color: color-mix(in srgb, var(--color-text) 70%, transparent); }
</style>
```

`src/pages/[lang]/diario/index.astro` — same pattern wrapping `<DiarioList locale={locale} />` with `path="/diario/"` and `fieldAnchor="diario"`.

`src/pages/[lang]/diario/[slug].astro`:

```astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
import EntryPage from '../../../components/EntryPage.astro';
import { listEntries } from '../../../content/entries';
import { LOCALES, getStrings, type Locale } from '../../../i18n';

export async function getStaticPaths() {
  const paths = [];
  for (const lang of LOCALES.filter((l) => l !== 'pt')) {
    const all = await listEntries(lang);
    for (const item of all) paths.push({ params: { lang, slug: item.slug }, props: { item, all } });
  }
  return paths;
}
const locale = Astro.params.lang as Locale;
const { item, all } = Astro.props;
const t = getStrings(locale);
---
<BaseLayout locale={locale} title={`${item.entry.data.title} — ${t.brand}`} path={`/diario/${item.slug}/`} fieldAnchor="diario">
  <EntryPage locale={locale} item={item} all={all} />
</BaseLayout>
```

Note: non-pt lists gap-fill with pt entries, so `/en/diario/chegando-no-rio/` exists and renders the pt body — with the `em português` tag visible on its card (`fromPt`). That is the §5 contract.

- [ ] **Step 2: Verify**

`npm run build` then `npm run preview`: check `/portfolio/en/` (English), `/portfolio/fr/` (English strings + fallback note), `/portfolio/en/diario/` (1 en card + 2 pt cards tagged "em português"), `/portfolio/ja/diario/a-site-idea/`. Language pills on any page link to the sibling page in each locale.

- [ ] **Step 3: Commit**

```bash
git add src/pages
git commit -m "feat: rotas por locale — inglês real, o resto cai pro inglês com aviso"
```

---

### Task 10: Ambient island — the WebGL field

**Files:**
- Create: `src/ambient/FieldIsland.astro`, `src/ambient/field.ts`, `src/ambient/fieldShader.ts`
- Modify: `src/layouts/BaseLayout.astro` (mount island), `package.json` (add three)

**Interfaces:**
- Consumes: `data-field-anchor` on `<body>`; tokens (colors are baked into the shader as vec3).
- Produces: `startField(canvas: HTMLCanvasElement): FieldHandle | null` where `FieldHandle = { setAnchor(a: 'home' | 'diario'): void; setPointer(xNdc: number, yNdc: number): void; setBreath(v: number): void; setGlow(x: number, y: number, strength: number): void; dispose(): void }`. Task 12 consumes `setBreath`/`setGlow`. Returns `null` when WebGL unavailable or reduced motion — CSS field stays.

- [ ] **Step 1: Install three**

```bash
npm install three
npm install -D @types/three
```

- [ ] **Step 2: Write the shader** — `src/ambient/fieldShader.ts`:

```ts
export const vertexShader = /* glsl */ `
  void main() { gl_Position = vec4(position, 1.0); }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform vec2 uAnchor;    // 0..1, origin top-left
  uniform vec2 uPointer;   // -1..1 offset, eased
  uniform float uBreath;   // 0..1
  uniform float uTime;
  uniform vec3 uGlow;      // xy: 0..1 pos, z: strength

  const vec3 PAPER  = vec3(0.953, 0.949, 0.949); // #f3f2f2
  const vec3 LB     = vec3(0.153, 0.263, 0.788); // #2743c9
  const vec3 LB500  = vec3(0.310, 0.420, 0.878); // #4f6be0
  const vec3 LB300  = vec3(0.690, 0.749, 1.000); // #b0bfff

  float blob(vec2 uv, vec2 c, float r) {
    float d = length((uv - c) * vec2(uRes.x / uRes.y, 1.0));
    return smoothstep(r, 0.0, d);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    uv.y = 1.0 - uv.y;
    vec2 drift = 0.015 * vec2(sin(uTime * 0.11), cos(uTime * 0.07));
    vec2 a = uAnchor + drift + uPointer * 0.02;
    float scale = 1.0 + uBreath * 0.08;

    vec3 col = PAPER;
    col = mix(col, LB,    0.55 * blob(uv, a,                      0.42 * scale));
    col = mix(col, LB500, 0.45 * blob(uv, a + vec2(-0.12, -0.10), 0.30 * scale));
    col = mix(col, LB300, 0.60 * blob(uv, a + vec2(0.08, 0.08),   0.50 * scale));
    col = mix(col, LB300, uGlow.z * blob(uv, uGlow.xy, 0.10));
    gl_FragColor = vec4(col, 1.0);
  }
`;
```

- [ ] **Step 3: Write `src/ambient/field.ts`**

```ts
import * as THREE from 'three';
import { fragmentShader, vertexShader } from './fieldShader';

export interface FieldHandle {
  setAnchor(a: 'home' | 'diario'): void;
  setPointer(x: number, y: number): void;
  setBreath(v: number): void;
  setGlow(x: number, y: number, strength: number): void;
  dispose(): void;
}

const ANCHORS = { home: new THREE.Vector2(0.8, 0.85), diario: new THREE.Vector2(0.15, 0.4) };

export function startField(canvas: HTMLCanvasElement): FieldHandle | null {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const uniforms = {
    uRes: { value: new THREE.Vector2() },
    uAnchor: { value: ANCHORS.home.clone() },
    uPointer: { value: new THREE.Vector2() },
    uBreath: { value: 0 },
    uTime: { value: 0 },
    uGlow: { value: new THREE.Vector3(0, 0, 0) },
  };
  const target = {
    anchor: ANCHORS.home.clone(),
    pointer: new THREE.Vector2(),
    breath: 0,
    glow: new THREE.Vector3(0, 0, 0),
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })));

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  };
  resize();
  addEventListener('resize', resize);

  let raf = 0;
  const clock = new THREE.Clock();
  const frame = () => {
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uAnchor.value.lerp(target.anchor, 0.03);
    uniforms.uPointer.value.lerp(target.pointer, 0.06);
    uniforms.uBreath.value += (target.breath - uniforms.uBreath.value) * 0.05;
    uniforms.uGlow.value.lerp(target.glow, 0.08);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    setAnchor: (a) => target.anchor.copy(ANCHORS[a]),
    setPointer: (x, y) => target.pointer.set(x, y),
    setBreath: (v) => { target.breath = v; },
    setGlow: (x, y, s) => target.glow.set(x, y, s),
    dispose: () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 4: Write `FieldIsland.astro`** and mount it in `BaseLayout` (replacing nothing — the CSS field stays as fallback beneath):

```astro
<canvas id="field-canvas" transition:persist="field" aria-hidden="true"></canvas>
<script>
  import { startField } from './field';

  const canvas = document.getElementById('field-canvas') as HTMLCanvasElement | null;
  if (canvas && !canvas.dataset.started) {
    canvas.dataset.started = '1';
    const field = startField(canvas);
    if (!field) {
      canvas.remove(); // CSS field beneath takes over
    } else {
      (window as any).__field = field; // Task 11/12 attach audio + glow here
      const sync = () => field.setAnchor(document.body.dataset.fieldAnchor === 'diario' ? 'diario' : 'home');
      sync();
      document.addEventListener('astro:page-load', sync);
      addEventListener('pointermove', (e) => {
        field.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
      }, { passive: true });
    }
  }
</script>
<style>
  canvas { position: fixed; inset: 0; z-index: -2; width: 100%; height: 100%; pointer-events: none; }
</style>
```

In `BaseLayout.astro`, place `<FieldIsland />` directly after the `.field-css` div. The canvas sits at the same `z-index: -2` but later in DOM order, so it paints over the CSS field when present; halftone stays above both at `-1`.

(Doc: docs.astro.build/en/guides/view-transitions/ — `transition:persist` keeps the element across navigations; `astro:page-load` fires after each swap.)

- [ ] **Step 5: Verify in browser**

`npm run dev`: field renders (visibly deeper than the CSS version — dev-compare by temporarily removing the canvas); pointer parallax leans the field; navigating home ↔ diário eases the anchor across the swap without the canvas remounting (check: `canvas.dataset.started` survives; no flash). With DevTools emulating `prefers-reduced-motion: reduce`, the canvas is removed and the static CSS field shows. Check a mobile viewport for jank (DPR cap active).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: o campo webgl respira atrás do papel e sobrevive à navegação"
```

---

### Task 11: Sound engine + button wiring

**Files:**
- Create: `src/sound/engine.ts`, `src/sound/wire.ts`
- Modify: `src/ambient/FieldIsland.astro` (init sound in the same persistent island)
- Test: `src/sound/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `#sound-toggle` button (Task 6), audio file at `${base}audio/ambient.mp3` (may be absent).
- Produces:
  ```ts
  type SoundState = 'idle' | 'playing' | 'paused' | 'unavailable';
  interface SoundEngine {
    handleFirstGesture(): void;
    toggle(): void;
    getState(): SoundState;
    subscribe(cb: (s: SoundState) => void): () => void;
    lowBand(): number; // 0..1, 0 unless playing
  }
  createSoundEngine(deps: EngineDeps): SoundEngine
  ```
  Task 12 consumes `lowBand()` and `getState()`.

- [ ] **Step 1: Write the failing tests**

`src/sound/__tests__/engine.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundEngine, type EngineDeps } from '../engine';

function fakeDeps(overrides: Partial<EngineDeps> = {}) {
  const listeners: Record<string, () => void> = {};
  const audio = {
    src: '', loop: false, crossOrigin: null as string | null,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn((ev: string, cb: () => void) => { listeners[ev] = cb; }),
  };
  const store = new Map<string, string>();
  const deps: EngineDeps = {
    src: '/portfolio/audio/ambient.mp3',
    createAudio: () => audio as unknown as HTMLAudioElement,
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    },
    connectAnalyser: null, // web audio absent in tests; engine must cope
    ...overrides,
  };
  return { deps, audio, store, listeners };
}

describe('máquina de estados do som', () => {
  it('nasce idle e não toca nada sozinho', () => {
    const { deps, audio } = fakeDeps();
    const e = createSoundEngine(deps);
    expect(e.getState()).toBe('idle');
    expect(audio.play).not.toHaveBeenCalled();
  });
  it('primeiro gesto toca (sem preferência salva)', () => {
    const { deps, audio } = fakeDeps();
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    expect(audio.play).toHaveBeenCalledOnce();
    expect(e.getState()).toBe('playing');
  });
  it('preferência pausada é respeitada no primeiro gesto', () => {
    const { deps, audio, store } = fakeDeps();
    store.set('som', 'paused');
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    expect(audio.play).not.toHaveBeenCalled();
    expect(e.getState()).toBe('paused');
  });
  it('toggle alterna e persiste', () => {
    const { deps, audio, store } = fakeDeps();
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    e.toggle();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(store.get('som')).toBe('paused');
    e.toggle();
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(store.get('som')).toBe('playing');
  });
  it('erro no áudio → unavailable, toggle vira no-op', () => {
    const { deps, audio, listeners } = fakeDeps();
    const e = createSoundEngine(deps);
    listeners['error']?.();
    expect(e.getState()).toBe('unavailable');
    e.toggle();
    expect(audio.play).not.toHaveBeenCalled();
  });
  it('gesto repetido não reinicia', () => {
    const { deps, audio } = fakeDeps();
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    e.handleFirstGesture();
    expect(audio.play).toHaveBeenCalledOnce();
  });
  it('lowBand é 0 quando não está tocando', () => {
    const { deps } = fakeDeps();
    const e = createSoundEngine(deps);
    expect(e.lowBand()).toBe(0);
  });
  it('notifica assinantes', () => {
    const { deps } = fakeDeps();
    const e = createSoundEngine(deps);
    const seen: string[] = [];
    e.subscribe((s) => seen.push(s));
    e.handleFirstGesture();
    e.toggle();
    expect(seen).toEqual(['playing', 'paused']);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/sound` → FAIL.

- [ ] **Step 3: Implement `src/sound/engine.ts`**

```ts
export type SoundState = 'idle' | 'playing' | 'paused' | 'unavailable';

export interface EngineDeps {
  src: string;
  createAudio: () => HTMLAudioElement;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Wraps the audio element in a WebAudio graph (gain fade + analyser). null = plain playback. */
  connectAnalyser: ((audio: HTMLAudioElement) => { lowBand: () => number }) | null;
}

export interface SoundEngine {
  handleFirstGesture(): void;
  toggle(): void;
  getState(): SoundState;
  subscribe(cb: (s: SoundState) => void): () => void;
  lowBand(): number;
}

const KEY = 'som';

export function createSoundEngine(deps: EngineDeps): SoundEngine {
  let state: SoundState = 'idle';
  let gestured = false;
  let analyser: { lowBand: () => number } | null = null;
  const subs = new Set<(s: SoundState) => void>();

  const audio = deps.createAudio();
  audio.src = deps.src;
  audio.loop = true;
  audio.addEventListener('error', () => set('unavailable'));

  function set(s: SoundState) {
    state = s;
    subs.forEach((cb) => cb(s));
  }

  function play() {
    analyser ??= deps.connectAnalyser?.(audio) ?? null;
    void audio.play().catch(() => set('unavailable'));
    if (state !== 'unavailable') {
      deps.storage.setItem(KEY, 'playing');
      set('playing');
    }
  }

  return {
    handleFirstGesture() {
      if (gestured || state === 'unavailable') return;
      gestured = true;
      if (deps.storage.getItem(KEY) === 'paused') set('paused');
      else play();
    },
    toggle() {
      if (state === 'unavailable') return;
      gestured = true;
      if (state === 'playing') {
        audio.pause();
        deps.storage.setItem(KEY, 'paused');
        set('paused');
      } else {
        play();
      }
    },
    getState: () => state,
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    lowBand: () => (state === 'playing' ? analyser?.lowBand() ?? 0 : 0),
  };
}
```

- [ ] **Step 4: Run tests — expect pass.** `npx vitest run src/sound`

- [ ] **Step 5: Write the browser wiring** — `src/sound/wire.ts`:

```ts
import { createSoundEngine, type SoundEngine } from './engine';

export function wireSound(base: string): SoundEngine {
  const engine = createSoundEngine({
    src: `${base}audio/ambient.mp3`,
    createAudio: () => new Audio(),
    storage: safeStorage(),
    connectAnalyser: (audio) => {
      const ctx = new AudioContext();
      const srcNode = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      srcNode.connect(gain).connect(analyser).connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 1.5);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      return {
        lowBand() {
          analyser.getByteFrequencyData(bins);
          let sum = 0;
          for (let i = 0; i < 8; i++) sum += bins[i]!;
          return sum / (8 * 255);
        },
      };
    },
  });

  const gesture = () => engine.handleFirstGesture();
  addEventListener('pointerdown', gesture, { once: true });
  addEventListener('keydown', gesture, { once: true });

  const syncButton = () => {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    const s = engine.getState();
    const playing = s === 'playing';
    btn.dataset.state = playing ? 'playing' : 'paused';
    btn.setAttribute('aria-label', btn.dataset[playing ? 'labelPlaying' : 'labelPaused'] ?? '');
    if (s === 'unavailable') btn.setAttribute('aria-disabled', 'true');
  };
  engine.subscribe(syncButton);
  document.addEventListener('astro:page-load', syncButton); // fresh button after each swap
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#sound-toggle')) engine.toggle();
  });
  syncButton();
  return engine;
}

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    return localStorage;
  } catch {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  }
}
```

In `FieldIsland.astro`'s script (persistent island — runs once), after the field init add:

```ts
import { wireSound } from '../sound/wire';
const engine = wireSound(import.meta.env.BASE_URL);
(window as any).__sound = engine;
```

The click handler uses delegation on `document` because view transitions replace the header (and its button) on every navigation, while this script runs once.

- [ ] **Step 6: Verify in browser**

No `public/audio/ambient.mp3` yet: first click anywhere → button flips to `unavailable`-safe paused visuals, no console crash. Drop any temporary local mp3 into `public/audio/ambient.mp3` (do NOT commit it): first click → fade-in over ~1.5s at 0.35, bars animate; toggle pauses; reload → preference honored (paused stays paused); navigate home ↔ diário → music never stops. Remove the temp file after.

- [ ] **Step 7: Commit**

```bash
git add src/sound src/ambient
git commit -m "feat: motor de som — gesto primeiro, fade de 1.5s, preferência lembrada"
```

---

### Task 12: Interaction synth, field breathing, map glow + tilt

**Files:**
- Create: `src/sound/synth.ts`, `src/ambient/mapDepth.ts`
- Modify: `src/ambient/FieldIsland.astro` (breath loop + synth + glow wiring), `src/components/HomePage.astro` (tilt data attr already present as `data-tilt`)
- Test: `src/sound/__tests__/synth.test.ts`

**Interfaces:**
- Consumes: `window.__field` (FieldHandle), `window.__sound` (SoundEngine), `[data-map]` SVG + `[data-node]` anchors, `[data-tilt]` card.
- Produces: `createSynth(deps: SynthDeps): { tick(): void; tap(index: number): void; swell(): void }` — gated internally on the engine state.

- [ ] **Step 1: Write the failing synth gating tests**

`src/sound/__tests__/synth.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSynth, type SynthDeps } from '../synth';

function fakeDeps(state: 'idle' | 'playing' | 'paused' | 'unavailable') {
  const played: number[] = [];
  const deps: SynthDeps = {
    getState: () => state,
    playTone: vi.fn((freq: number) => void played.push(freq)),
  };
  return { deps, played };
}

describe('synth respeita o portão do som', () => {
  it('não toca antes do primeiro gesto (idle)', () => {
    const { deps, played } = fakeDeps('idle');
    createSynth(deps).tick();
    expect(played).toHaveLength(0);
  });
  it('não toca mutado (paused)', () => {
    const { deps, played } = fakeDeps('paused');
    const s = createSynth(deps);
    s.tick(); s.tap(3); s.swell();
    expect(played).toHaveLength(0);
  });
  it('toca quando a música toca', () => {
    const { deps, played } = fakeDeps('playing');
    createSynth(deps).tick();
    expect(played).toHaveLength(1);
  });
  it('tap varia o tom por índice do nó (pentatônica de lá menor)', () => {
    const { deps, played } = fakeDeps('playing');
    const s = createSynth(deps);
    s.tap(0); s.tap(1);
    expect(played[0]).not.toBe(played[1]);
  });
});
```

- [ ] **Step 2: Run to verify failure**, then **implement `src/sound/synth.ts`**

```ts
export interface SynthDeps {
  getState: () => 'idle' | 'playing' | 'paused' | 'unavailable';
  /** (freq, durationSec, gainPeak) — injected; real impl uses WebAudio */
  playTone: (freq: number, duration: number, gain: number) => void;
}

/* pentatônica de lá menor: A3 C4 D4 E4 G4 A4 ... */
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

export function createSynth(deps: SynthDeps) {
  const gated = (fn: () => void) => () => {
    if (deps.getState() === 'playing') fn();
  };
  return {
    tick: gated(() => deps.playTone(SCALE[5]!, 0.06, 0.03)),
    tap(index: number) {
      if (deps.getState() !== 'playing') return;
      deps.playTone(SCALE[index % SCALE.length]!, 0.18, 0.06),
      deps.playTone(SCALE[index % SCALE.length]! * 2, 0.12, 0.02);
    },
    swell: gated(() => deps.playTone(SCALE[0]!, 0.6, 0.04)),
  };
}

/** Real WebAudio playTone for the browser wiring. */
export function makePlayTone(ctx: AudioContext) {
  return (freq: number, duration: number, gain: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(filter).connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  };
}
```

Design note: gating on `state === 'playing'` makes the music toggle the single mute switch for everything, per spec §7 ("gated by the same sound toggle"). Run `npx vitest run src/sound` → pass.

- [ ] **Step 3: Write `src/ambient/mapDepth.ts`** — glow + tilt wiring (re-bound after every navigation):

```ts
import type { FieldHandle } from './field';

interface Hooks { tick(): void; tap(index: number): void }

export function bindMapDepth(field: FieldHandle | null, synth: Hooks): void {
  const svg = document.querySelector<SVGSVGElement>('[data-map]');
  const card = document.querySelector<HTMLElement>('[data-tilt]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (svg) {
    svg.querySelectorAll<SVGAElement>('[data-node]').forEach((node, index) => {
      const dot = node.querySelector('.dot')!;
      const show = () => {
        synth.tick();
        if (field && !reduced) {
          const r = dot.getBoundingClientRect();
          field.setGlow((r.x + r.width / 2) / innerWidth, (r.y + r.height / 2) / innerHeight, 0.5);
        }
      };
      const hide = () => field?.setGlow(0, 0, 0);
      node.addEventListener('pointerenter', show);
      node.addEventListener('focus', show);
      node.addEventListener('pointerleave', hide);
      node.addEventListener('blur', hide);
      node.addEventListener('click', () => synth.tap(index));
    });
  }

  if (card && !reduced) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.x) / r.width - 0.5;
      const y = (e.clientY - r.y) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * 3}deg) rotateX(${-y * 3}deg)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  }
}
```

- [ ] **Step 4: Wire everything in `FieldIsland.astro`'s script** (after field + sound init):

```ts
import { createSynth, makePlayTone } from '../sound/synth';
import { bindMapDepth } from './mapDepth';

let synthCtx: AudioContext | null = null;
const synth = createSynth({
  getState: () => engine.getState(),
  playTone: (f, d, g) => {
    synthCtx ??= new AudioContext();
    makePlayTone(synthCtx)(f, d, g);
  },
});

const rebind = () => bindMapDepth(field, synth);
rebind();
document.addEventListener('astro:page-load', rebind);
document.addEventListener('astro:before-preparation', () => synth.swell());

/* breathing: poll lowBand; fall back to a slow sine when silent */
if (field) {
  const start = performance.now();
  setInterval(() => {
    const lb = engine.lowBand();
    field.setBreath(lb > 0 ? lb : 0.5 + 0.5 * Math.sin((performance.now() - start) / 4000));
  }, 100);
}
```

(`astro:before-preparation` fires as a view-transition navigation starts — doc: docs.astro.build/en/guides/view-transitions/#astrobefore-preparation.)

- [ ] **Step 5: Verify in browser**

With a temp mp3 present and sound on: hovering map nodes ticks + glows through the glass card; clicking a node plays its note and lands on the filtered diário; navigating plays the low swell; the field visibly pulses with the bass. Sound off: total silence (no ticks), glow/tilt still work. Reduced motion emulated: no tilt, no glow, no breathing (canvas already gone), and sounds still respect the toggle. Remove the temp mp3.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: o mapa vira instrumento — ticks, brilho, tilt e o campo pulsando no grave"
```

---

### Task 13: CI, Playwright + axe smoke, go live

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `.github/workflows/deploy.yml`
- Delete: any stale workflow in `.github/workflows/` from the old project

**Interfaces:**
- Consumes: the whole built site under `/portfolio/`.

- [ ] **Step 1: Install and configure Playwright**

```bash
npm install -D @playwright/test @axe-core/playwright
npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4321/portfolio/' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321/portfolio/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Write `e2e/smoke.spec.ts`**

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home pt renderiza com o h1 e o mapa', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('nicholas');
  await expect(page.locator('[data-map] [data-node]')).toHaveCount(14);
});

test('home en renderiza em inglês', async ({ page }) => {
  await page.goto('./en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('deep link de entrada funciona sob a base', async ({ page }) => {
  await page.goto('./diario/chegando-no-rio/');
  await expect(page.locator('article h2')).toContainText('chegando no rio');
});

test('filtro por lugar via query string', async ({ page }) => {
  await page.goto('./diario/?lugar=atins');
  await expect(page.locator('[data-place]:visible')).toHaveCount(1);
  await expect(page.locator('[data-chip]')).toBeVisible();
});

test('teclado alcança um nó do mapa e o botão de som', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab'); // skip link
  await expect(page.locator('.skip-link')).toBeFocused();
  const node = page.locator('[data-node="rio"]');
  await node.focus();
  await expect(node).toBeFocused();
  const sound = page.locator('#sound-toggle');
  await sound.focus();
  await expect(sound).toBeFocused();
  await expect(sound).toHaveAttribute('aria-label', /som/);
});

test('axe: home sem violações sérias', async ({ page }) => {
  await page.goto('./');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});

test('axe: diário sem violações sérias', async ({ page }) => {
  await page.goto('./diario/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
```

- [ ] **Step 3: Run locally, fix what axe finds**

Run: `npx playwright test`
Expected: all pass. Axe findings (likely candidates: color-contrast on 70%-alpha meta text, missing landmark roles) get fixed in the components — tokens rule (`--lb-700`) is non-negotiable; alpha percentages on gray text may be raised to pass.

- [ ] **Step 4: Write the deploy workflow** — `.github/workflows/deploy.yml`:

```yaml
name: deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
      - uses: actions/deploy-pages@v4
        id: deployment
```

(Doc: docs.astro.build/en/guides/deploy/github/ — withastro/action builds and uploads the Pages artifact; deploy-pages publishes it.) Remove any leftover workflow file from the old project in `.github/workflows/`.

- [ ] **Step 5: Enable Pages and push**

```bash
gh api repos/heisenico/portfolio/pages -X POST -f build_type=workflow || \
  echo "se falhar: Settings → Pages → Source: GitHub Actions, no navegador"
git add -A
git commit -m "ci: testes e deploy pro github pages a cada push na main"
git push origin main
```

- [ ] **Step 6: Verify live**

Watch `gh run watch`; when green, open `https://heisenico.github.io/portfolio/` — check home, `/en/`, a diary deep link, and the map filter on the live site. Confirm the site works with sound absent (no mp3 committed).

- [ ] **Step 7: Final full-suite run + close out**

```bash
npx vitest run && npx playwright test
```

Report to Nicholas: what shipped, the live URL, and the three §12 open items (Epidemic track + mp3-in-repo decision, English strings review, real posts).

---

## Plan Self-Review (performed at write time)

- **Spec coverage:** §1–§2 → Tasks 1, 7–9; §3 layout → Tasks 1–2; §4 routes/i18n → Tasks 3, 9; §5 diary → Tasks 5, 8; §6 field/glow/tilt → Tasks 10, 12; §7 sound/synth/island → Tasks 10–12; §8 a11y → Tasks 2, 6, 7, 13; §9 testing → Tasks 2–5, 11–13; §10 deploy → Task 13; §11/§12 honored as exclusions/open items. One deliberate refinement recorded in Task 9: locale fallback pages are generated by our `[lang]` routes with the `locale → en → pt` string chain instead of Astro's `fallback` rewrite (which would serve pt content to fr/es/zh/ja — the spec wants en). One YAGNI cut recorded in Task 8: "mais antigas ↓" pagination link omitted until real post volume needs it.
- **Placeholder scan:** clean — every code step carries real code; visual-fidelity steps point at concrete README sections + the mock with explicit checklists.
- **Type consistency:** `FieldHandle` (T10) matches T12's usage; `SoundEngine`/`EngineDeps` (T11) match T12's `getState` consumption and the test fakes; `DiaryEntry` (T5) matches T7–T9 props; `localeUrl(locale, path, base?)` used uniformly; `PLACE_IDS`/`PlaceId` flow from T4 into T5/T7/T8.
