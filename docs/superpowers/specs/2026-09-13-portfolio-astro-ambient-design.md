# Portfolio — Astro + ambient engine (design spec)

**Date:** 2026-09-13
**Status:** approved in brainstorming; awaiting implementation plan
**Fidelity source:** `README.md` at repo root (the handoff). This spec pins the
architecture and behavior decisions; all visual detail — tokens, type scale,
spacing, verbatim copy, map coordinates, artboard layouts — lives in the README
and the design reference and is **not** duplicated here. Where this spec and the
README conflict on visuals, the README wins; on architecture, this spec wins.

## 1. What we are building

Nicholas Ferrer's personal portfolio: **Home** (bio, node map of places,
convite + links) and **Diário digital** (blog with short notes, photos, video).
Broadsheet newsprint aesthetic, Luminous Blue, liquid glass. Ambient no-vocal
deep house starts on the first user gesture. Mobile first. pt-BR default, six
locales in the language control.

The previous codebase in this repo (vanilla TS three.js "tinta sobre papel"
project) is abandoned. Its files are already deleted in the working tree; the
first implementation act is committing that wipe. The design reference files
(`Portfolio nico fada.dc.html`, `support.js`, `_ds/`) move to
`design-reference/` — kept as source of truth, never shipped. The `_ds`
Broadsheet token sheet may be copied into `src/styles/` as allowed by the
handoff.

## 2. Decisions made (with the reasoning)

| Decision | Choice | Why |
|---|---|---|
| three.js scope | **Ambient engine** | WebGL field reacting to pointer + music; DOM owns all text. Fun without sacrificing a11y/SEO. Not a full 3D scene. |
| Hosting | **GitHub Pages, project URL** | `heisenico.github.io/portfolio` via GitHub Actions. Zero new accounts. Static HTML → deep links need no redirect hack. |
| i18n scope v1 | **pt-BR + en real content; all 6 in the control** | fr/es/zh/ja generated from en via fallback until written. Full i18n architecture from day one. |
| Sound scope | **Music + synthesized interaction sounds** | Ambient track per README, plus quiet Web Audio synth ticks/tones on map and transitions. No audio-reactive-everything. |
| Architecture | **Astro + one persistent three.js/audio island** | Astro is TS + Vite under the hood (footer copy stays honest). Content collections, i18n routing, static pages for free; effort goes to field/map/sound. |
| Map rendering | **SVG map, WebGL depth behind it** | Spec'd coordinates, focusable nodes, text labels, ≥44px targets come free in SVG. three.js adds glow + the card gets 2.5D pointer tilt. A WebGL map would need hit-target hacks for the same result. |

## 3. Repo layout

```
astro.config.ts          site: https://heisenico.github.io, base: /portfolio
design-reference/        the .dc.html mock, support.js, _ds/  (never shipped)
public/audio/            deep house track (user-supplied; engine tolerates absence)
src/
  pages/                 index, diario/index, diario/[slug] (+ locale-prefixed)
  content/diario/<locale>/*.md
  i18n/                  pt.ts, en.ts, … typed dictionaries + fallback
  ambient/               three.js field, map glow, tilt (the persistent island)
  sound/                 audio engine + interaction synth
  layouts/  styles/      tokens.css (from _ds), glass, prose
```

TypeScript strict. No UI framework — Astro components plus small vanilla
scripts.

## 4. Routes & i18n

- pt-BR unprefixed: `/`, `/diario/`, `/diario/<slug>/`. Other locales
  path-prefixed: `/en/…`, `/fr/…`, `/es/…`, `/zh/…`, `/ja/…`.
- Astro built-in i18n: `prefixDefaultLocale: false`, `fallback` of
  fr/es/zh/ja → en (rewrite, real pages at real URLs).
- Language = URL. The segmented control is six links to the current page's
  locale sibling. Picking one stores the preference in `localStorage`;
  `<html lang>` is per-page. **No auto-redirect on entry** (crawlable,
  no flash). Hreflang alternates emitted per page.
- UI strings: one typed dictionary per locale, keys checked by TypeScript so a
  missing key is a build error. Fallback chain `locale → en → pt`. README's
  verbatim pt-BR copy goes in `pt.ts` untouched; en drafted by Claude,
  reviewed by Nicholas.

## 5. Diary content pipeline

- Astro content collection, zod schema: `title`, `date`, `place` (enum of the
  14 map node ids — build fails on a bad id), optional media
  (`image | gallery | video`), images **require `alt`** (build fails without).
  Locale by folder.
- List newest-first (artboard 1c); entry page glass-card article (1d).
- An entry that exists only in pt appears on other locales' lists with a small
  "em português" tag — untranslated posts stay visible, not hidden.
- v1 ships 2–3 clearly-marked placeholder entries wired to map nodes so the
  map interaction is demonstrable; Nicholas replaces them with real posts.
- Map ↔ diary: node tap navigates to `/diario/?lugar=<node>`; the list filters
  client-side with a visible "mostrando: <lugar> · limpar" chip (a real
  button). Entry pages link back "ver no mapa →". With JS off the list is
  simply unfiltered.

## 6. Ambient engine (three.js)

- One fixed full-viewport `<canvas>` behind all content; single scene, one
  fragment-shader quad painting the Luminous Blue radial field from the tokens.
  Field anchor is a uniform (lower-right on home, left on diário) that eases
  during page transitions instead of jump-cutting.
- Animation inputs, all gentle: slow autonomous drift; pointer parallax (field
  leans a few px toward pointer/touch); breathing driven by low-band energy
  from the audio `AnalyserNode`, falling back to a slow time-based breath when
  sound is off.
- Halftone dot overlay stays pure CSS per tokens.
- Map depth: soft WebGL glow behind the active/hovered SVG node, projected
  through the same 0–100 viewBox space; the map's glass card gets a subtle
  2.5D pointer tilt.
- Performance: DPR capped at 2, rAF paused on hidden tab, no postprocessing.
- Degradation: WebGL unavailable → canvas removed, CSS gradient field (already
  in the token sheet). `prefers-reduced-motion` → static field, no tilt, no
  transition fades; glow becomes a static halo.

## 7. Sound

- **Engine:** `HTMLAudioElement` (streams, loops) routed through Web Audio:
  `GainNode` fade-in ~1.5s to volume ~0.35; `AnalyserNode` tapped for the
  field. Starts on first `pointerdown`/`keydown` anywhere; never autoplays.
  Header toggle with `aria-label` "som: tocando"/"som: pausado"; state in
  `localStorage`; bars animate only while playing (static `scaleY(.6)` under
  reduced motion).
- **Interaction synth:** no audio files — Web Audio oscillators + envelopes in
  A minor (sits under deep house). Soft filtered tick on node hover/focus;
  fuller tap tone on node select, pitch varying by node (the map plays like an
  instrument); low swell on page transition. ~-20dB under the music, gated by
  the same sound toggle, never before first gesture.
- **Persistent island:** field canvas + audio engine live in one
  `transition:persist` unit so music and WebGL context survive view-transition
  navigations. This is the highest-risk seam — tested hardest.
- **Track file:** user supplies the Epidemic Sound mp3 into `public/audio/`.
  Until then the engine no-ops gracefully: sound button renders in paused
  state, interaction sounds still work. **Flag:** committing the mp3 to a
  public repo makes the raw file downloadable; Epidemic's license covers
  published content, bare-file hosting is Nicholas's call.

## 8. Accessibility

Baseline: fully usable with no JS, no WebGL, no sound; everything else layers
on top.

- Skip link; `:focus-visible` 2px `--lb` outline; language control is a link
  group with `aria-current`; sound toggle labeled per state.
- Map nodes: SVG `<a>` links (deliberate deviation from the README's
  `role="button"` — the chosen behavior in §5 is navigation, so link semantics
  are correct), descriptive labels ("rio de janeiro, 3 entradas no diário"),
  invisible ≥44px hit circles.
- Contrast: body-size blue text always `--lb-700` (4.5:1 on paper), guarded by
  a token test.
- `prefers-reduced-motion` collapses all motion at once (field, tilt, fades,
  bars).
- Media: `alt` schema-required; video play disc is a labeled button.

## 9. Testing

- **Vitest (logic):** i18n fallback chain + dictionary completeness; content
  schema rejections (bad `place`, missing `alt`); sound-engine state machine
  (gesture gate, toggle persistence); map coordinate table matches README
  values; token contrast guard.
- **Playwright smoke (built site, in CI before deploy):** home + diário render
  in pt and en; entry deep link works under `/portfolio` base; keyboard-only
  walk reaches a map node and the sound toggle; `axe-core` scan passes on both
  page types.

## 10. Deploy

GitHub Actions with the official Astro action: push to `main` → Vitest →
build → Playwright smoke → deploy to GitHub Pages
(`heisenico.github.io/portfolio`).

## 11. Out of scope for v1

- Real fr/es/zh/ja content (architecture ready; fallback to en).
- Auto-redirect to remembered locale.
- Real diary posts and real photos (placeholders shipped).
- Audio-reactive visuals beyond the field's low-band breathing.
- Custom domain.

## 12. Open items (tracked, not blocking)

- Nicholas supplies the Epidemic Sound track + decides on committing the mp3
  (§7).
- Nicholas reviews the drafted English strings (§4).
- Real diary posts replace placeholders (§5).
