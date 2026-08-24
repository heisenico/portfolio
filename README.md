# Portfolio

A personal site built as one continuous Three.js scene instead of a stack of
pages. `/` reveals a procedurally generated wireframe tree, ambient particles
react to the pointer, and a low-poly cat leaps onto a branch and bolts if you
look at it too closely. `/blog` flies the same camera up into the canopy,
where every post hangs from a real branch, labelled and clickable. `/blog/:slug`
flies along that branch and grows a small world at its tip out of the post's
own content. The renderer, the tree, and the WebGL context are never rebuilt
between routes — navigating is a camera move, not a page load.

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm test` | Vitest unit suite |
| `npm run typecheck` | `tsc --noEmit` |

## Routes

| Path | What's there |
| --- | --- |
| `/` | The full tree, boot camera framing |
| `/blog` | Camera flies into the canopy; each post is a labelled branch, plus a plain `<ul>` fallback for keyboards, screen readers and crawlers |
| `/blog/:slug` | Camera flies along that post's branch; the post's world grows at the tip as you read |
| anything else | Not-found page, camera flies back to the full tree |

Routing is client-side (`src/core/Router.ts`), on the History API rather than
hashes: `pushState`/`popstate`, with internal link clicks intercepted so the
page is never actually reloaded. That matters here specifically because
rebuilding the scene per navigation would cost real shader-compile time and
throw away an in-flight camera move — the whole concept depends on it being
the same tree throughout.

GitHub Pages serves static files with no server-side rewrite, so a hard
reload or a shared link straight to `/blog/:slug` has no server that knows
what that path is. Pages' own fallback for an unmatched path is to serve
`404.html` if the site has one, so the deploy workflow's build step copies
the built shell there:

```bash
cp dist/index.html dist/404.html
```

(`.github/workflows/deploy.yml`, the "SPA fallback for deep links" step.)
`dist/404.html` ends up byte-identical to `dist/index.html` — same app,
same JS bundle — and once it loads, the client router reads the real
`location.pathname` and renders the matching route. `BASE` (`src/core/routes.ts`)
strips and re-adds the `/portfolio/` prefix Pages serves the site under
(`vite.config.ts` sets that base only when `GITHUB_ACTIONS` is set), so the
same links resolve correctly both in local dev at `/` and deployed at
`/portfolio/`.

## Writing a post

A post is a markdown file in `content/posts/`, named
`YYYY-MM-DD-slug.md`. The slug — the part after the date — is what the URL
uses and what a bespoke world (see below) is matched against.

Frontmatter:

```yaml
---
titulo: how i got here
data: 2026-08-22
resumo: one line, used as the meta description and the blog list's byline.
tags: [career]
---
```

- `titulo` and `data` are required; the build throws if either is missing.
- `data` must be `AAAA-MM-DD` (`YYYY-MM-DD`) — anything else throws, because
  posts sort by this string and a wrong format sorts wrong silently instead.
- `tags` is optional and only its first entry currently does anything: it
  seeds the pen pressure a generated post-world drifts toward (see below).
- `rascunho: true` marks a draft. Drafts are included in dev and dropped from
  the production build.

Everything below the frontmatter is the post body, rendered to HTML at build
time (`plugins/posts.ts`, via `marked`) into a virtual module,
`virtual:posts`. The browser receives finished HTML — no markdown or YAML
parser ships in the bundle, because the text doesn't change after the build.

One thing about the body worth knowing before you write: **paragraph count is
content, not just formatting.** `countParagraphs` counts top-level blocks that
aren't a heading, a code fence, a rule, or an HTML comment, with a floor of
one. That number becomes `post.paragrafos`, and the default generated world
puts one twig per paragraph (the reference bespoke world, the street in
`content/worlds/como-cheguei-aqui.ts`, does the same with figures in its
yard, up to a cap of eight) — so restructuring a post's paragraphs changes
what grows at the tip of its branch, not just how the text reads.

In dev, editing a file under `content/posts/` triggers a full page reload —
no need to restart Vite.

## Adding a bespoke world

Every post gets a world automatically: `GeneratedPostWorld`
(`src/world/PostWorld.ts`) grows a fan of twigs out of the branch tip, seeded
deterministically from the post's slug, one twig per paragraph, with the pen
pressure (line gain) derived from the post's first tag. Publishing never depends on anyone
having built a scene by hand.

A post can replace that with a hand-built world instead: export a
`PostWorldModule` as the default export of `content/worlds/<slug>.ts`, where
`<slug>` matches the post's slug exactly.
`content/worlds/como-cheguei-aqui.ts` — a small suburban street built from
wireframe primitives — is the reference implementation; `PostWorldModule`
itself is defined in `src/world/PostWorld.ts`:

```ts
interface PostWorldModule {
  build(ctx: PostWorldContext): void
  update(dt: number, elapsed: number, progress: number): void
  dispose(): void
}
```

Any world, generated or bespoke, must satisfy all seven items of the world
contract:

1. **Wireframe grammar only.** `LineSegments` and `Points` with
   `AdditiveBlending` and `depthWrite: false`. No solid shaded meshes, no
   textures, no imported models.
2. **It assembles by wavefront.** Geometry is revealed by a distance-gated
   uniform, using `branchVertex` / `branchFragment` from
   `src/fx/shaders/branch.ts` directly, or a sibling in `src/fx/shaders/` that
   is a documented copy of that pair plus one extra gate. Things do not fade
   in; they are *scanned* in.
3. **Ink in, ink out.** The world is monochrome: lines start at `INK_REST`
   (`src/world/palette.ts`) with gain `1.0`, may vary in *weight* while the
   reader is inside the post, but must be back at gain `1.0` by
   `progress >= 0.97`. Hue never drifts — the only colour on the site is the
   cat. The reader leaves the way they came in.
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

**The slug-rename footgun.** A bespoke world is found purely by filename
matching slug — `content/worlds/<slug>.ts` against the post's current slug.
Rename the post (which means renaming its markdown file, since the slug is
derived from the filename) without renaming the world file to match, and the
post falls back to the generic generated world. Silently: nothing throws,
nothing warns in production, the page just renders a different world than the
one you wrote. `orphanWorlds()` in `src/world/PostWorld.ts` exists specifically
to catch this — it diffs the hand-built world files against the live post
slugs — and `src/main.ts` calls it and warns to the console in dev whenever a
world file has no post to match it. There is no equivalent guard in
production; if you rename a post, check the dev console for that warning
before you publish.

## The lowercase rule

Every string of user-facing copy in `src/content/` is *authored* lowercase —
never rendered lowercase with `text-transform: lowercase`. A screen reader
announces the text as written in the source, not as it's styled; a CSS
transform would make the page look lowercase while still announcing whatever
case was actually typed. Writing the rule into the strings themselves is the
only way the visual rule and the accessible rule are the same rule.

This is enforced by a test, not a convention someone has to remember:
`src/content/__tests__/caixa-baixa.test.ts` walks every string in
`src/content/site.ts`, `sobre.ts`, `aprendizado.ts` and `paixoes.ts`
(skipping keys that hold a URL, id or enum rather than prose) and fails the
build if any of them differs from its own `toLocaleLowerCase('pt-BR')`. It
also asserts a floor on how much text it found, so a change to the content
shape that silently breaks the walker fails loudly instead of passing
vacuously. Note the scope: this test covers the structured content modules
under `src/content/` — it does not currently walk post markdown
(`content/posts/*.md`) or bespoke world files.

## How it works

**The scan reveal.** Every branch vertex carries its distance from the scan
origin. The fragment shader compares that against a wavefront radius, which
gives three zones from one comparison: unreached (discarded), a bright leading
band, and the dim settled wireframe behind it. The settled wireframe and the
wavefront are *summed* rather than mixed — mixing caps the crest at the same
brightness as the rest state, and the wavefront stops reading as a wavefront.
Post worlds reuse the same shader pair and the same beat: nothing in the
canopy fades in, everything is scanned.

**Wireframe tubes.** WebGL cannot draw a line wider than one pixel, so low-depth
branches are built as tubes — rings plus longitudinal rails — while twigs stay
single lines. Without this the trunk has exactly the same visual weight as a
twig and the tree reads as a flat scribble.

**Parallax.** Not `OrbitControls`, which needs a drag to do anything. The camera
rides a fixed-radius shell around the scene focus, its angles damped toward
pointer-derived targets, with a slow Lissajous drift underneath so the world
keeps breathing when the pointer is still. Dragging widens the same range.

**Framing.** Camera distance is derived from the current subject's per-axis
half-extents and the live field of view, so the composition survives any
viewport and any subject — the full tree, the canopy, or a single branch.
`CameraRig.flyTo` and `CameraRig.flyAlongBranch` (`src/core/CameraRig.ts`)
both resolve to the same underlying fit; only the subject and duration
differ.

**Particles.** The ambient mote field animates entirely in the vertex shader
from time and a per-particle seed, so several thousand cost nothing on the CPU.
They wobble within a bounded neighbourhood rather than integrating a velocity,
which would slowly drain the volume as particles wandered off. The cursor trail
is genuinely stateful, so it runs on the CPU over a fixed ring buffer with no
allocation after construction.

**The cat.** `Cat` is pose-only and holds no state; `CatBrain` is a pure state
machine over time and a single `hovered` boolean. That split is what makes the
behaviour unit-testable without a GL context, including the properties that are
hardest to eyeball — that hover cannot interrupt a leap, and that the cat never
teleports while on screen.

**Liquid glass.** Real glass refracts. An SVG `feDisplacementMap` bends the
backdrop at each pane's rim, with the displacement field generated at runtime
from the signed distance to a rounded rectangle, so the bend follows the actual
corner radius.

**Performance.** A synchronous estimate from device hints picks the quality tier
before the first frame, since buffers must be sized before any frame time
exists. Measured frame time can then downgrade it, and a downgrade shrinks the
particle draw range rather than reallocating. Frames over 200ms are discarded as
stalls, not capability — a tab switch during the probe would otherwise strand a
fast machine on the low tier permanently. Downgrades are one-way.

## Browser support

Liquid glass refraction requires SVG filter references inside `backdrop-filter`,
which **Chromium supports and Safari and Firefox do not**. This is feature
detected at runtime: those browsers get the fallback path, keeping the blur,
saturation, specular rim and inner shading, and losing only the refraction. The
console logs which path was taken on load.

`prefers-reduced-motion: reduce` is read once at boot (`src/core/Quality.ts`)
and threaded through the camera rig, the tree reveal, the wind and firefly
systems, and every post world: autonomous drift, dolly and travel are removed
rather than sped up, and every world-contract beat snaps straight to its end
state at the current reading progress instead of easing there.

## Content

Site copy — name, nav labels, "about", passions, links — lives in
`src/content/*.ts`. Editing it needs no markup or style changes, and it must
stay lowercase (see above). Post content lives in `content/posts/*.md`
(see "Writing a post"). Bespoke post worlds live in `content/worlds/*.ts`
(see "Adding a bespoke world").

## Layout

```
content/
  posts/    post markdown, one file per post
  worlds/   bespoke PostWorldModules, matched to a post by filename = slug
plugins/
  posts.ts  build-time markdown → virtual:posts pipeline
src/
  content/  site copy, all lowercase, enforced by test
  core/     renderer, loop, pointer, camera rig, quality budgeting, router
  world/    tree generation, scan reveal, ground, particles, cat, post worlds
  fx/       post-processing chain and every GLSL source
  ui/       DOM content, pages, liquid glass, card scan-in, intro timeline
  util/     seeded rng, easing and timeline, simplex/curl noise
```

## Verification

`?verify` enables `preserveDrawingBuffer` and exposes a `window.__world` handle
with `step()`, `freezeScan()` and `snap()`. It exists because external screen
capture reads the compositor, which serves a stale frame for a WebGL canvas —
the GL buffer held a gated scan while the capture showed a completed one. Note
that `snap()` overlays an image the glass panes will sample through
`backdrop-filter`, so do not use it when verifying the UI layer.
