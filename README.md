# Portfolio

A single-page portfolio built on vanilla Three.js. A procedurally generated tree
is revealed by a Death Stranding–style scan pulse, ambient particles react to
the pointer, and a low-poly cat leaps onto a branch and bolts when you look at
it too closely.

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

## How it works

**The scan reveal.** Every branch vertex carries its distance from the scan
origin. The fragment shader compares that against a wavefront radius, which
gives three zones from one comparison: unreached (discarded), a bright leading
band, and the dim settled wireframe behind it. The settled wireframe and the
wavefront are *summed* rather than mixed — mixing caps the crest at the same
brightness as the rest state, and the wavefront stops reading as a wavefront.

**Wireframe tubes.** WebGL cannot draw a line wider than one pixel, so low-depth
branches are built as tubes — rings plus longitudinal rails — while twigs stay
single lines. Without this the trunk has exactly the same visual weight as a
twig and the tree reads as a flat scribble.

**Parallax.** Not `OrbitControls`, which needs a drag to do anything. The camera
rides a fixed-radius shell around the scene focus, its angles damped toward
pointer-derived targets, with a slow Lissajous drift underneath so the world
keeps breathing when the pointer is still. Dragging widens the same range.

**Framing.** Camera distance is derived from the tree's per-axis half-extents
and the live field of view, so the composition survives any viewport. On
portrait the horizontal becomes the binding constraint and the camera pulls
back automatically.

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
corner radius. See the caveat below.

**Performance.** A synchronous estimate from device hints picks the quality tier
before the first frame, since buffers must be sized before any frame time
exists. Measured frame time can then downgrade it, and a downgrade shrinks the
particle draw range rather than reallocating. Frames over 200ms are discarded as
stalls, not capability — a tab switch during the probe would otherwise strand a
fast machine on the low tier permanently.

## Browser support

Liquid glass refraction requires SVG filter references inside `backdrop-filter`,
which **Chromium supports and Safari and Firefox do not**. This is feature
detected at runtime: those browsers get `.lg-fallback`, keeping the blur,
saturation, specular rim and inner shading, and losing only the refraction. The
console logs which path was taken on load.

`prefers-reduced-motion: reduce` replaces the intro sweep with a fade, stills
the autonomous camera drift, and turns the card scan-in into a plain fade.

## Content

All copy lives in [`src/content.ts`](src/content.ts). The strings there are
placeholders; replacing them needs no markup or style changes.

## Layout

```
src/
  core/     renderer, loop, pointer, camera rig, quality budgeting
  world/    tree generation, scan reveal, ground, particles, cat
  fx/       post-processing chain and every GLSL source
  ui/       DOM content, liquid glass, card scan-in, intro timeline
  util/     seeded rng, easing and timeline, simplex/curl noise
```

## Verification

`?verify` enables `preserveDrawingBuffer` and exposes a `window.__world` handle
with `step()`, `freezeScan()` and `snap()`. It exists because external screen
capture reads the compositor, which serves a stale frame for a WebGL canvas —
the GL buffer held a gated scan while the capture showed a completed one. Note
that `snap()` overlays an image the glass panes will sample through
`backdrop-filter`, so do not use it when verifying the UI layer.
