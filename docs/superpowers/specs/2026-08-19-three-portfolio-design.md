# Three.js Portfolio — Design

Date: 2026-08-19
Status: Approved

## Purpose

A personal portfolio site that reads as a living, breathing world rather than a document.
A procedurally generated tree is revealed by a Death Stranding-style scan pulse on load,
content cards materialise with a matching scan animation and liquid-glass surfacing, ambient
particles flow through the volume and react to the pointer, and a low-poly cat leaps to a
branch and flees when the pointer touches it.

Success means: the intro reads unmistakably as a scanning reveal, the world keeps moving when
the user does not, the cat behaviour is legible without explanation, and the whole thing holds
60fps on an M-series Mac with no console errors.

## Stack

- Three.js (vanilla, no React) — every headline effect is a custom shader, not a scene-graph
  problem, so a reconciler between the code and the frame loop would only be in the way.
- Vite + TypeScript.
- Vitest for the pure-logic unit tests.
- No animation library. A ~60-line tween/easing utility covers everything needed.
- Post-processing via `three/examples/jsm` `EffectComposer` (no extra dependency).

## Architecture

`core/Loop.ts` owns the single `requestAnimationFrame` driver; `main.ts` constructs every
subsystem, registers them with the loop in a fixed tick order, and owns nothing else.
No subsystem owns a loop of its own, and no subsystem reaches into another's internals — they
communicate through constructor-injected references and a small typed event emitter.

```
src/
  main.ts                  bootstrap; constructs and wires modules; registers tick order
  content.ts               ALL user-facing copy, single source of truth

  core/
    Stage.ts               renderer, scene, camera, composer, resize
    Loop.ts                the single RAF driver; delta/elapsed; pauses on tab hidden
    Pointer.ts             normalised pointer, world projection, velocity, idle
    Quality.ts             perf probe -> tier; DPR + particle budgets
    Events.ts              tiny typed emitter

  world/
    BranchSystem.ts        seeded recursive branch generation -> line + marker buffers
    ScanReveal.ts          owns the uScanRadius timeline; drives branch/marker shaders
    ScanPulse.ts           expanding additive shell mesh (the visible wavefront)
    Ground.ts              fog-dissolved ground grid
    Motes.ts               ambient curl-noise particle field with pointer repulsion
    PointerTrail.ts        cursor-emitted particle ring buffer
    Cat.ts                 procedural cat mesh + transform rig (pose API only)
    CatBrain.ts            pure state machine driving Cat's pose over time

  fx/
    Post.ts                composer: bloom + grain/vignette/chromatic pass
    shaders/               GLSL sources as typed template strings

  ui/
    Cards.ts               DOM card construction + 3D anchor -> screen projection
    CardScan.ts            IntersectionObserver-driven scan-in animation
    LiquidGlass.ts         SVG filter injection, capability detection, fallback class
    Intro.ts               intro timeline orchestration; click to skip

  util/
    tween.ts               easings + tween runner
    noise.ts               simplex/curl noise (TS + GLSL twin)
    rng.ts                 seeded PRNG (mulberry32)
```

Boundaries that matter:

- `Cat.ts` exposes a pose API (`setStance`, `setPosition`, `setSquash`, `setTailPhase`) and
  knows nothing about behaviour. `CatBrain.ts` is a pure state machine that consumes time and
  a `hovered` boolean and emits a pose — testable with no WebGL context.
- `BranchSystem.ts` returns plain typed arrays plus a list of perch points. `ScanReveal.ts`
  and `Cat.ts` consume those without knowing how they were generated.
- `Quality.ts` is read by every system at construction. Nothing else decides its own budget.

## Feature specifications

### Intro scan reveal

The branch geometry renders as `LineSegments` with a custom `ShaderMaterial` carrying a
`uScanRadius` uniform. Per fragment, `d = distance(vWorldPos, uScanOrigin)`; the segment is
invisible where `d > uScanRadius`, and intensity is
`mix(uRestIntensity, 1.0, 1.0 - smoothstep(0.0, uBandWidth, uScanRadius - d))`.
The result is a bright leading wavefront decaying into a persistent dim wireframe behind it.

An instanced layer of small chevron markers sits on branch vertices. Each instance stores its
own distance-to-origin; it scales in from zero as the wavefront crosses it, overshoots, then
settles to low opacity.

`ScanPulse` renders the wavefront itself as an expanding additive sphere shell with a fresnel
falloff so it reads as a shell rather than a ball.

Timeline: 0.0s black -> 0.3s pulse ignites -> 0.3-3.2s radius eases outward past the far
branches -> 2.4s cards begin their own scan-in, staggered -> 3.6s idle state. Clicking or
pressing any key at any point fast-forwards the timeline to its end.

### Orbit parallax

Not `OrbitControls`, which requires dragging. `Pointer` produces a normalised `-1..1` vector;
the camera controller maps it to azimuth/polar offsets on a fixed-radius shell around the
scene target, critically damped so it settles without oscillation. A slow autonomous
Lissajous drift is summed underneath so the camera keeps moving when the pointer is idle.
Dragging widens the same offset range rather than switching to a different control mode.

### Particles

`Motes` — ambient field, count by tier (3000 / 1500 / 700). Positions advance along a curl
noise field evaluated in the vertex shader from `uTime`, so there is no per-frame CPU cost.
Pointer repulsion is applied in the shader from a `uPointerWorld` uniform with an inverse
square falloff clamped at a maximum displacement. Additive blending, size attenuation.

`PointerTrail` — a CPU-updated ring buffer (600 / 300 / 150). Particles spawn at the pointer's
world projection with velocity inherited from pointer velocity plus jitter; they fade over a
~1.2s life. Spawn rate scales with pointer speed so fast motion throws a denser trail.

### Cat

Geometry is assembled from primitives: a scaled sphere body, an icosahedron head, cone ears,
four box legs, and a tail swept as a `TubeGeometry` along a curve whose control points are
animated. Material matches the world's wireframe/glass treatment.

`CatBrain` states and transitions:

| State      | Enters from        | Leaves when                        | Goes to  |
|------------|--------------------|------------------------------------|----------|
| `absent`   | initial, `fled`    | return delay elapses (~4s)         | `approach` |
| `approach` | `absent`           | reaches launch mark                | `crouch` |
| `crouch`   | `approach`         | crouch hold elapses (~0.5s)        | `leap`   |
| `leap`     | `crouch`           | arc completes                      | `perch`  |
| `perch`    | `leap`             | `hovered` becomes true             | `startle` |
| `startle`  | `perch`            | startle hold elapses (~0.25s)      | `flee`   |
| `flee`     | `startle`          | arc completes off-screen           | `fled`   |
| `fled`     | `flee`             | immediately                        | `absent` |

Leap motion is a horizontal lerp plus a parabolic vertical term, with squash applied on
takeoff and stretch at apex. Hover is detected by raycasting a forgiving bounding sphere
proxy, not the assembled meshes. Hover is ignored outside `perch` so the cat cannot be
interrupted mid-arc.

### Liquid glass

Cards are DOM elements layered above the canvas, not WebGL geometry, so text stays crisp,
selectable, and accessible to screen readers. Each card carries a 3D anchor point; every frame
that anchor is projected to screen space and the card is translated to match, so cards
parallax with the world.

Glass treatment, in order of application:

1. `backdrop-filter: url(#lg-displace) blur(14px) saturate(180%)` — the SVG
   `feDisplacementMap` bends the backdrop at the card's edges while leaving the centre clear.
   This refraction is what separates liquid glass from a frosted panel.
2. A specular edge: a conic-gradient border layer, brightest where the surface normal would
   catch the key light.
3. An inner shadow and a faint top-edge highlight for thickness.
4. A slight chromatic split at the rim, achieved by offsetting the R and B channels in the
   same SVG filter chain.

**Known limitation:** SVG filter references inside `backdrop-filter` are supported in Chrome
and Edge but not in Safari. `LiquidGlass.ts` feature-detects with
`CSS.supports('backdrop-filter', 'url(#x)')` and applies a `.lg-fallback` class when absent,
which keeps blur, saturation, specular edge, and inner shadow but drops the refraction. This
is a deliberate accepted degradation, not a defect to fix.

### Card scan-on-load

Triggered per card by `IntersectionObserver` at 25% visibility, and by `Intro` for cards
already in view at load. The animation runs ~900ms:

- An SVG rect border draws itself via `stroke-dashoffset`.
- A bright horizontal scan line sweeps top to bottom.
- Text rows reveal behind the line via an animated `clip-path` inset.
- A brief chromatic split tracks the scan line's y position.

### Performance and accessibility

`Quality.ts` measures the first 30 frames and selects a tier, setting DPR cap (2 / 1.5 / 1),
particle counts, bloom resolution scale, and whether the grain pass runs. The loop pauses
entirely on `visibilitychange`.

`prefers-reduced-motion: reduce` replaces the intro with a 400ms fade, stills the autonomous
camera drift (pointer parallax remains, at reduced amplitude), stops the cat loop with the cat
already perched, and disables the card scan sweep in favour of a fade.

Cards are reachable by keyboard, have visible focus rings that do not depend on the glass
effect, and meet WCAG AA contrast against the darkest and lightest points of the backdrop
behind them.

## Testing

Unit tests (Vitest, no WebGL context required):

- `tween.ts` — easing boundary values and monotonicity.
- `CatBrain.ts` — every transition in the table above, plus: hover during `leap` does not
  interrupt; the full cycle returns to `absent`.
- `BranchSystem.ts` — identical seed produces identical output; perch points lie on branches.
- `Quality.ts` — frame-time samples map to the expected tier at each boundary.
- `rng.ts` — determinism.

Browser verification, driven directly rather than delegated to the user:

- Page loads with zero console errors and zero WebGL warnings.
- Screenshots at intro t=0.5s, 1.5s, 3.0s, and idle confirm the scan reads as a scan.
- Sustained FPS probe over several seconds stays at or near 60.
- Programmatic hover over the cat's proxy transitions `CatBrain` out of `perch`.
- Cards render glass in Chrome; the fallback path is exercised by forcing `.lg-fallback`.
- Mobile viewport (375x812) renders without horizontal overflow or layout collapse.

## Content

All copy lives in `content.ts` as a typed structure: identity (name, role, blurb), a list of
projects (title, description, tags, links), and contact links. Placeholder copy for a staff
front-end engineer ships initially; replacing it is a single-file edit with no markup changes.

## Delivery

Public GitHub repository `portfolio` under `heisenico`, with a GitHub Actions workflow
building on push to `main` and deploying to GitHub Pages. Nothing is pushed without explicit
confirmation first.

## Out of scope

- CMS or any content backend. Copy is compiled in.
- Analytics, cookie consent, or any third-party script.
- A blog, project detail routes, or any routing at all. Single page.
- Physically accurate cat anatomy or gait. The cat is stylised and readable, not simulated.
