# Handoff: nicholas ferrer — portfolio (home + diário digital)

## Overview
Personal portfolio for Nicholas Ferrer (Rio de Janeiro, software developer at Base Exchange, digital nomad). Two sections: **Home** (bio, node map of places lived/worked, invitation + links) and **Diário digital** (blog: short notes, photos, video). Mobile first, desktop second. pt-BR default, then en, fr, es, zh, ja. Ambient no-vocal deep house plays on the first user tap. Aesthetic: Broadsheet newsprint (Source Serif 4 everywhere, paper ground, whitespace, no boxes) with a single spot color, **Luminous Blue** (WGSN × Coloro colour of the year 2027), and "liquid glass" translucent panels floating over a soft blue field.

Target stack (existing repo github.com/heisenico): TypeScript, three.js, Vite. Recreate the design there; three.js may render the field + map.

## About the Design Files
`Portfolio nico fada.dc.html` (+ `support.js`, `_ds/`) is a **design reference built in HTML** showing intended look and behaviour. Do not ship it. Recreate the screens in the target codebase with its patterns. The `_ds/…/styles.css` token sheet may be copied as-is for tokens.

## Fidelity
**High-fidelity.** Colors, type, spacing and copy are final. Photos are placeholders. The four artboards are shown side by side on a canvas; the canvas chrome (`.dv-*` classes, id badges 1a–1d, the "premissas" note) is NOT part of the product.

## Screens / Views

### 1a — Home, mobile (390 wide)
- Page: `#e9e8e6`-ish paper is the canvas only; product page background = `--color-bg` #f3f2f2 with the **field** behind (see Tokens → Field). Horizontal padding 20px, bottom 28px.
- **Skip link** "pular para o conteúdo", visually hidden until focused.
- **Header** (glass pill, `border-radius:999px`, padding 10px 6px 10px 14px, margin-top 14px, flex space-between): brand "nicholas ferrer" (Source Serif 4 600, 17px, nowrap) · right cluster (gap 8px): language segmented control (pt en fr es 中 日) and sound button.
  - Language seg: pill container `rgba(255,255,255,.4)`, 1px border `rgba(255,255,255,.72)`, padding 2px, gap 2px; options 11px, line-height 24px, min-width 26px, color `--lb-700`; current = fill `--lb`, white text. Desktop: 12px/min-width 32px.
  - Sound button: 44×44 hit area, 4 bars 2px wide × 12px, `--lb`, `scaleY` bouncing 1.1s ease-in-out infinite (delays 0/.2/.4/.1s). `aria-label="som: tocando"` / "som: pausado". Reduced motion: static at scaleY(.6).
- **Main** padding 56px 4px 0.
  - H1 "nicholas / ferrer" (two lines) — Source Serif 4 600, 54px, line-height 1.05, letter-spacing -.02em.
  - Three bio paragraphs, 16px/26px, color = text at 82% (`color-mix(in srgb, var(--color-text) 82%, transparent)`), margin-top 22px then 14px each. Copy verbatim (see Copy).
  - **Map figure** (glass, padding 18px 18px 14px, margin-top 44px): kicker "por onde passei" (12px, uppercase, letter-spacing .08em, text 70%) → square SVG (viewBox 0 0 100 100, width 100%) → caption 13px/20px text 70%: "nômade digital, raiz no rio. toque em um nó para ler o que vivi lá."
  - **Convite** (margin-top 44px): kicker "convite", italic p "pra trabalho criativo, de engenharia a design:", then 5 link rows (flex, baseline, gap 12px, padding 10px 0, 16px/26px): label bold `--lb-700` min-width 88px + note 14.5px text 70%. No underline; whole row is the link.
  - **Diário CTA** (glass, margin-top 40px, padding 16px 18px, flex space-between): "diário digital" (600, 18px) · "último: 04 set →" (`--lb-700`, 14px).
  - **Footer** (margin-top 40px, 13px/21px, text 70%): experiment paragraph (github link underlined), then italic "som: deep house sem vocal, toca no primeiro toque. desligue na barra acima." margin-top 12px.

### 1b — Home, desktop (1280 wide)
- Padding 24px 56px 48px. Grid `5fr / 7fr`, column-gap 64px; header spans both columns.
- Header as mobile but padding 8px 10px 8px 20px, plus center nav (gap 28px, 15px): "home" (text color, current) · "diário digital" (link color). Right cluster gap 10px.
- Left column (`max-width:52ch`, padding-top 96px): H1 88px (margin-left -.035em), bio paragraphs 17px/28px (margin-top 36px then 14px), convite links in a 2-column grid (column-gap 24px) with label above note (column flex, gap 2px), footer margin-top 56px.
- Right column: map figure (glass, padding 24px 28px 20px, margin-top 72px, `position:sticky; top:24px`). Header row: kicker "por onde passei" · "13 lugares · 1 próximo" (13px `--lb-700`). Caption row split: "nômade digital, raiz no rio." / "passe o mouse em um nó para ler."

### 1c — Diário digital, mobile (390)
- Same header; brand links to home. Main padding 48px 4px 0.
- Kicker "diário digital", H1 "o que eu ando vivendo" 40px, intro p 15px/24px (youtube link).
- Entry list: column, gap 20px, margin-top 36px. Each entry is a glass card:
  - Photo entry: image 4:3 on top (radius inherited, overflow hidden), body padding 16px 18px 18px. Meta row (12.5px, text 70%, space-between): "04 set 2026 · rio de janeiro" · "nó: rio" (`--lb-700`). H2 22px 600 letter-spacing -.01em margin-top 8px. Body 15px/24px margin-top 8px.
  - Gallery entry: 3 square thumbs (flex, gap 8px, radius 10px), third has a video play disc 36px white 85% with `--lb` glyph.
  - Text-only entry: same without media.
- "mais antigas ↓" centered link, 14px, margin-top 32px.

### 1d — Diário digital, desktop (1280), entry open
- Padding 24px 56px 56px. Header; then grid `300px / 1fr`, gap 72px, margin-top 72px.
- Aside: kicker, H1 34px, intro 15px/24px, entry nav (column, margin-top 36px). Each item: date+place 12.5px text 70% above title; padding 12px 0. Current item: padding 12px 14px, negative margin -14px, glass fill + border, radius 12px, title 600.
- Article (glass, max-width 760px, overflow hidden): 16:9 photo, body padding 28px 36px 36px. Meta row 13px with "ver no mapa →" (`--lb-700`). H2 36px letter-spacing -.015em. Body 17px/28px max-width 58ch. Blockquote italic 22px/32px `--lb-900` max-width 34ch, margin-top 28px.

## Map (SVG, viewBox 0 0 100 100)
Rio de Janeiro is the root node; edges are polylines from Rio, Estônia is a dashed "próximo" node reached by a dashed quadratic curve from New York.
Coordinates (cx, cy): rio 41.4,83.7 (root: r 2.4 + halo r 4.2 at 18%) · tiradentes 40.7,82 · salvador 38,75.4 · recife 45.2,74.3 · joão pessoa 48.1,69.6 · natal 48.1,68.7 · atins 47.8,67.4 · chapada dos veadeiros 41.8,64.4 · buenos aires 29.3,94.9 · havana 10.1,39.9 · cancún 6.5,41.8 · washington dc 14.4,24.9 · new york 16.8,23.1 · estônia 95.8,5.3 (next).
Edges: `M41.4 83.7 L40.7 82 M41.4 83.7 L38 75.4 M41.4 83.7 L45.2 74.3 L48.1 69.6 L48.1 68.7 L47.8 67.4 L41.8 64.4 M41.4 83.7 L29.3 94.9 M41.4 83.7 L10.1 39.9 L6.5 41.8 M10.1 39.9 L14.4 24.9 L16.8 23.1` and `M16.8 23.1 Q60 -6 95.8 5.3` dashed 1.5 1.5.
Styles: node fill `--lb`, stroke #fff 1.2, r 1.5 (mobile) / 1.3 (desktop); next node fill #fff stroke `--lb` dasharray 1.6 1.2; edges stroke `--lb-700` .5 opacity .55; labels italic Source Serif 4, 3.3 units (mobile) / 2.6 (desktop), lowercase.
Behaviour: tap/hover a node → show diary entries tagged to that place (tooltip or scroll to filtered diário). Nodes need `role="button"`, `tabindex`, `aria-label`, ≥44px hit target (use an invisible larger circle). Optional three.js version: same graph, subtle parallax; must have an SVG/HTML fallback and honour reduced motion.

## Interactions & Behavior
- **Sound**: on first `pointerdown`/`keydown` anywhere → start the Epidemic Sound track (loop, fade-in ~1.5s, volume ~.35). Sound button toggles pause/play; state persisted in localStorage; bars animate only while playing. Respect `prefers-reduced-motion` (static bars) and never autoplay without gesture.
- **Language**: segmented control switches all UI copy; persist in localStorage; also `<html lang>`. Default pt-BR; order pt, en, fr, es, zh, ja. Bio/diary content is per-locale content, not machine-translated at runtime.
- **Glass**: `backdrop-filter: blur(18px) saturate(1.5)`; fallback solid `rgba(255,255,255,.85)` when unsupported.
- **Hover/focus**: links `--lb-700` → `--lb` on hover; `:focus-visible { outline: 2px solid var(--lb); outline-offset: 2px }`.
- **Responsive**: single column ≤ 767px (1a/1c); two-column grid ≥ 1024px (1b/1d); in between, single column with max-width 720px content.
- **Diary**: list ordered newest first; entry page at `/diario/<slug>`; each entry has `place` (node id), `date`, optional media (image | gallery | video).

## State Management
`lang` (pt|en|fr|es|zh|ja), `soundPlaying`, `soundStarted`, `activeNode` (place id | null), `entries[]` (static JSON/MD at build time), `currentEntry`.

## Design Tokens
Base: Broadsheet `styles.css` (fonts `--font-heading`/`--font-body` = Source Serif 4; `--color-bg` #f3f2f2; `--color-text` #201e1d). Replace the system's cyan/magenta with the blue ramp; do not use magenta.
Luminous Blue ramp: `--lb` #2743c9 (base) · 100 #ecf0ff · 200 #d5ddff · 300 #b0bfff · 400 #7f95f5 · 500 #4f6be0 · 700 #1c31a0 · 900 #0e1750. Body-size text in blue uses 700 (4.5:1 on paper).
Glass: bg `rgba(255,255,255,.52)`, border 1px `rgba(255,255,255,.72)`, shadow `0 1px 0 rgba(255,255,255,.8) inset, 0 12px 32px rgba(14,23,80,.14)`, radius 18px, sheen `::before linear-gradient(135deg, rgba(255,255,255,.55), transparent 40%, transparent 70%, rgba(255,255,255,.25))`.
Field (page background layer, `pointer-events:none`): radial gradients of `--lb` at .55/.45, `--lb-500` .45, `--lb-300` .6 placed lower-right (home) / left (diário), plus halftone overlay `radial-gradient(circle, rgba(14,23,80,.18) 30%, transparent 32%)` size 3px, multiply, opacity .5.
Photo placeholder: gradient `--lb-200 → --lb-400` with the same halftone dots (real photos: apply Broadsheet `.halftone`).
Type scale: 88/54 (h1 desktop/mobile), 40/36/34 (section h1/article h2), 22 (card h2), 17/28 & 16/26 & 15/24 body, 14.5/13/12.5 meta, 12 kicker uppercase .08em.
Radii: 18 glass, 12 nav item, 10 thumb, 999 pills. Spacing follows the values above (multiples of ~4/8; Broadsheet density 1.25×).

## Copy (pt-BR, verbatim)
Bio: "eu moro no rio de janeiro. trabalho com desenvolvimento de software na base exchange, ajudo a criar uma nova bolsa de valores no Brasil." / "gosto muito de aprender sobre coisas novas. engenharia, design, arte, música, cinema, literatura." / "se estiver pelo rio e quiser trocar uma idea, me mande uma DM. adoraria tomar um café e conversar sobre criar coisas novas, fazer a web mais acessível e divertida, além de claro, IA."
Footer: "esse site é um experimento. é uma forma de criar arte na web. espero que esteja curtindo essa passagem por aqui. é feito com typescript, three.js e vite. o código fonte está no github."
Convite: "pra trabalho criativo, de engenharia a design:"
Links: youtube https://www.youtube.com/@heisenico "um diário digital. também falo de javascript e faço umas playlists legais!" · goodreads https://www.goodreads.com/user/show/203531558-nicholas "o que eu ando lendo." · letterboxd https://letterboxd.com/nicholasferrer/ "o que eu ando assistindo." · linkedin https://www.linkedin.com/in/ferrernicholas/ "a parte formal" · github https://github.com/heisenico "onde este site mora."
Diary sample entries in the mock are placeholders written for layout; replace with real posts.

## Assets
- Source Serif 4 (Google Fonts / system), via Broadsheet tokens.
- Phosphor icons, duotone, if any icon is needed (none required in the mock besides the ▶ glyph).
- Audio: one no-vocal deep house track from Epidemic Sound (user supplies; license required).
- Photos: user supplies; none in the mock.

## Files
- `Portfolio nico fada.dc.html` — the four artboards (1a home mobile, 1b home desktop, 1c diário mobile, 1d diário desktop). Open in a browser.
- `support.js` — runtime for the mock only.
- `_ds/broadsheet-…/styles.css` — Broadsheet token sheet and components; `_ds_bundle.js` — component bundle (mock only).
