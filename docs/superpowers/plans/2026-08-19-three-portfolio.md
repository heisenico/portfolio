# Three.js Portfolio Implementation Plan

> **For agentic workers:** Executed inline in-session via superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page Three.js portfolio whose world is revealed by a Death
Stranding-style scan, carries pointer-reactive particles and a low-poly cat that leaps to a
branch and flees on hover, with liquid-glass DOM cards that scan themselves into view.

**Architecture:** One RAF driver (`core/Loop.ts`) ticks a fixed-order list of subsystems that
`main.ts` constructs and wires. Behaviour is separated from rendering wherever it can be
tested without a GL context — most importantly `CatBrain` (pure state machine) from `Cat`
(pose-only mesh). Content cards are DOM, projected from 3D anchors each frame.

**Tech Stack:** Three.js (vanilla), Vite, TypeScript, Vitest. No animation library, no
postprocessing package beyond `three/examples/jsm`.

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-08-19-three-portfolio-design.md`.
- Vanilla Three.js only. No React, no R3F, no drei, no GSAP.
- All user-facing copy lives in `src/content.ts`. No copy literals in any other file.
- Every system reads its budget from `Quality`; no module hardcodes a particle count or DPR.
- `prefers-reduced-motion: reduce` must be honoured by every animated system.
- Zero console errors and zero WebGL warnings on load is a release gate, not a nicety.
- Commit after each task.

**Deviation from spec, recorded:** the spec names "the camera controller" without a filename.
This plan gives it `src/core/CameraRig.ts`.

---

### Task 1: Scaffold

**Files:** Create `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`,
`src/main.ts`, `src/styles/base.css`, `vitest.config.ts`

**Produces:** `npm run dev`, `npm run build`, `npm test` all functional.

- [ ] Step 1: `npm init -y`; install `three`, and dev-install `typescript`, `vite`,
      `vitest`, `@types/three`.
- [ ] Step 2: Write `tsconfig.json` — `strict: true`, `moduleResolution: "bundler"`,
      `target: "ES2022"`, `noUncheckedIndexedAccess: true`.
- [ ] Step 3: Write `index.html` with `<canvas id="stage">`, `#ui` overlay root, and the
      SVG filter defs container `#lg-defs`.
- [ ] Step 4: Write `src/main.ts` printing nothing but importing three, to prove the build.
- [ ] Step 5: Run `npm run build`. Expected: succeeds, emits `dist/`.
- [ ] Step 6: Commit.

---

### Task 2: Pure utilities

**Files:** Create `src/util/rng.ts`, `src/util/tween.ts`, `src/util/noise.ts`,
`src/util/__tests__/{rng,tween,noise}.test.ts`

**Produces:**
- `mulberry32(seed: number): () => number`
- `randRange(rng, min, max): number`
- Easings: `easeOutCubic|easeInOutCubic|easeOutBack|easeOutElastic|easeInQuad(t: number): number`
- `damp(current, target, lambda, dt): number` — frame-rate independent exponential smoothing
- `Timeline` class: `at(t, fn)`, `update(elapsed)`, `skipToEnd()`
- `simplex3(x, y, z): number` and `curl3(x, y, z, out: Vector3): Vector3`
- `GLSL_SIMPLEX`, `GLSL_CURL` — GLSL twin sources as strings

- [ ] Step 1: Write failing tests: `mulberry32(42)` twice yields identical first 5 values;
      every easing satisfies `f(0) === 0` and `f(1) === 1`; `easeOutCubic` is monotonic
      across 100 samples; `damp` converges toward target and is stable at `dt = 0`.
- [ ] Step 2: Run `npx vitest run`. Expected: FAIL, modules not found.
- [ ] Step 3: Implement the three util modules.
- [ ] Step 4: Run `npx vitest run`. Expected: PASS.
- [ ] Step 5: Commit.

---

### Task 3: Quality tiering

**Files:** Create `src/core/Quality.ts`, `src/core/__tests__/Quality.test.ts`

**Consumes:** nothing.
**Produces:** `type Tier = 'high' | 'moderate' | 'low'`;
`class Quality { tier: Tier; dprCap: number; motes: number; trail: number; bloomScale: number;
grain: boolean; reducedMotion: boolean; sample(frameMs: number): void; get settled(): boolean }`

Tier boundaries from mean frame time over 30 samples: `< 20ms` high, `< 34ms` moderate,
otherwise low. Budgets: motes 3000/1500/700, trail 600/300/150, dprCap 2/1.5/1,
bloomScale 0.5/0.35/0.25, grain true/true/false.

- [ ] Step 1: Write failing tests for each boundary (feed 30 samples of 10ms, 25ms, 50ms) and
      that `settled` is false before 30 samples.
- [ ] Step 2: Run vitest. Expected: FAIL.
- [ ] Step 3: Implement. `reducedMotion` reads `matchMedia`, guarded for the test env.
- [ ] Step 4: Run vitest. Expected: PASS.
- [ ] Step 5: Commit.

---

### Task 4: Stage, Loop, Events

**Files:** Create `src/core/Events.ts`, `src/core/Stage.ts`, `src/core/Loop.ts`;
modify `src/main.ts`

**Consumes:** `Quality`.
**Produces:**
- `Emitter<M>` with `on(k, fn)`, `off(k, fn)`, `emit(k, payload)`
- `Stage { renderer, scene, camera, size: {w,h,dpr}, onResize(fn), render() }`
- `Loop { add(fn: (dt: number, elapsed: number) => void), start(), stop() }` — clamps `dt`
  to 0.05s max, pauses on `visibilitychange`

- [ ] Step 1: Implement the three modules; `Stage` sets `ACESFilmicToneMapping`,
      `outputColorSpace = SRGBColorSpace`, exponential fog.
- [ ] Step 2: Wire in `main.ts` to render an empty dark scene.
- [ ] Step 3: Run `npm run dev`, load in browser, confirm dark canvas, no console errors.
- [ ] Step 4: Commit.

---

### Task 5: Pointer and CameraRig

**Files:** Create `src/core/Pointer.ts`, `src/core/CameraRig.ts`; modify `src/main.ts`

**Consumes:** `Stage`, `Loop`, `Quality`, `damp` from `util/tween`.
**Produces:**
- `Pointer { ndc: Vector2, velocity: Vector2, isDown: boolean, idleFor: number,
  worldAt(depth: number): Vector3, update(dt) }`
- `CameraRig { update(dt) }` — damped azimuth/polar from `pointer.ndc` plus a Lissajous
  drift; drag multiplies amplitude by 2.5; amplitude scaled to 0.3 and drift off under
  reduced motion.

- [ ] Step 1: Implement both, add a temporary reference cube to `main.ts` to see parallax.
- [ ] Step 2: Load in browser, move pointer, confirm the cube parallaxes and settles without
      oscillating.
- [ ] Step 3: Remove the reference cube. Commit.

---

### Task 6: Branch generation

**Files:** Create `src/world/BranchSystem.ts`, `src/world/__tests__/BranchSystem.test.ts`

**Consumes:** `mulberry32`.
**Produces:** `interface BranchData { positions: Float32Array; distances: Float32Array;
markerMatrices: Float32Array; markerDistances: Float32Array; perches: Vector3[]; bounds: number }`
and `generateBranches(seed: number, origin: Vector3): BranchData`.

Recursive: 4 trunk splits, depth 6, per-level length decay 0.72, angle spread 0.5rad, slight
gravity bias. `distances` is per-vertex distance from `origin`, consumed by the scan shader.
Perches are endpoint positions at depth 3-4 within a usable height band.

- [ ] Step 1: Write failing tests: same seed produces byte-identical `positions`; different
      seeds differ; `perches.length >= 4`; every perch is within `bounds` of origin;
      `positions.length` is a multiple of 6 (line segment pairs).
- [ ] Step 2: Run vitest. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run vitest. Expected: PASS.
- [ ] Step 5: Commit.

---

### Task 7: Scan reveal shader and branch rendering

**Files:** Create `src/fx/shaders/branch.ts`, `src/fx/shaders/marker.ts`,
`src/world/ScanReveal.ts`; modify `src/main.ts`

**Consumes:** `BranchData`, `Stage`, `Loop`.
**Produces:** `ScanReveal { radius: number, group: Object3D, setRadius(r), update(dt),
readonly maxRadius: number }`

Branch fragment intensity:
`mix(uRest, 1.0, 1.0 - smoothstep(0.0, uBand, uScanRadius - vDist))`, discarded where
`vDist > uScanRadius`. Markers are an `InstancedMesh` of small triangles with per-instance
`aDist`, scaling in with `easeOutBack` behaviour baked into the shader as an overshoot curve.

- [ ] Step 1: Implement both shaders and `ScanReveal`.
- [ ] Step 2: In `main.ts`, drive `radius` from a temporary time ramp.
- [ ] Step 3: Browser-verify: wavefront is visibly brighter than the settled wireframe;
      markers pop at the wavefront.
- [ ] Step 4: Commit.

---

### Task 8: Pulse shell and ground

**Files:** Create `src/world/ScanPulse.ts`, `src/world/Ground.ts`, `src/fx/shaders/pulse.ts`

**Consumes:** `Stage`, `ScanReveal.radius`.
**Produces:** `ScanPulse { mesh, update(dt, radius) }`, `Ground { mesh, update(dt) }`

Pulse: additive `SphereGeometry` shell, `BackSide` disabled, fresnel `pow(1 - dot(N,V), 3)`,
opacity falling off as radius approaches max. Ground: radial grid whose lines fade into the
fog, with a slow breathing emissive pulse.

- [ ] Step 1: Implement both, wire into `main.ts`.
- [ ] Step 2: Browser-verify the shell reads as an expanding shell, not a filled ball.
- [ ] Step 3: Commit.

---

### Task 9: Ambient motes

**Files:** Create `src/world/Motes.ts`, `src/fx/shaders/motes.ts`

**Consumes:** `Quality.motes`, `Pointer`, `GLSL_CURL`.
**Produces:** `Motes { points, update(dt, pointerWorld: Vector3) }`

Vertex shader advances each point along a curl field from `uTime` and its per-point seed, so
the CPU does no per-particle work. Pointer repulsion: displacement along the normalised
offset with `1/(1 + d*d)` falloff, clamped.

- [ ] Step 1: Implement, wire in.
- [ ] Step 2: Browser-verify particles drift continuously and visibly part around the cursor.
- [ ] Step 3: Commit.

---

### Task 10: Pointer trail

**Files:** Create `src/world/PointerTrail.ts`

**Consumes:** `Quality.trail`, `Pointer`.
**Produces:** `PointerTrail { points, update(dt, pointer: Pointer) }`

CPU ring buffer. Spawn count per frame is `clamp(round(pointerSpeed * k), 0, 6)`. Each
particle carries position, velocity, age, life, seed; alpha and size fall off with `age/life`.

- [ ] Step 1: Implement, wire in.
- [ ] Step 2: Browser-verify a trail appears on movement and none accumulates when idle.
- [ ] Step 3: Commit.

---

### Task 11: Cat mesh and pose API

**Files:** Create `src/world/Cat.ts`

**Consumes:** `Stage`.
**Produces:** `Cat { group: Object3D, proxy: Sphere, setPose(p: CatPose): void }` where
`interface CatPose { position: Vector3; facing: number; crouch: number; squash: number;
tailPhase: number; earPerk: number; visible: boolean }`

`Cat` contains no timers, no state, and no `update`. It is a pure function of pose.

- [ ] Step 1: Implement geometry assembly and `setPose`.
- [ ] Step 2: In `main.ts`, temporarily drive pose from a slider-free time ramp to confirm
      squash, crouch, tail, and facing all visibly respond.
- [ ] Step 3: Browser-verify the silhouette reads as a cat.
- [ ] Step 4: Commit.

---

### Task 12: Cat behaviour

**Files:** Create `src/world/CatBrain.ts`, `src/world/__tests__/CatBrain.test.ts`;
modify `src/main.ts`

**Consumes:** `perches` from `BranchData`, `CatPose` type, easings.
**Produces:** `CatBrain { state: CatState, update(dt: number, hovered: boolean): CatPose }`
with `type CatState = 'absent'|'approach'|'crouch'|'leap'|'perch'|'startle'|'flee'|'fled'`

- [ ] Step 1: Write failing tests covering every row of the spec's transition table, plus:
      `hovered = true` during `leap` leaves state `leap`; a full cycle from `absent` back to
      `absent` visits all eight states in order; pose position is continuous across a
      transition (no teleport greater than 0.5 units in one 16ms tick).
- [ ] Step 2: Run vitest. Expected: FAIL.
- [ ] Step 3: Implement the state machine.
- [ ] Step 4: Run vitest. Expected: PASS.
- [ ] Step 5: Wire into `main.ts` with a `Raycaster` against `cat.proxy` for `hovered`.
- [ ] Step 6: Browser-verify: the cat approaches, leaps, perches; hovering makes it flee;
      it returns.
- [ ] Step 7: Commit.

---

### Task 13: Post-processing

**Files:** Create `src/fx/Post.ts`, `src/fx/shaders/finish.ts`; modify `src/core/Stage.ts`

**Consumes:** `Stage`, `Quality`.
**Produces:** `Post { composer, resize(w, h), render(dt) }`

`EffectComposer` -> `RenderPass` -> `UnrealBloomPass` (resolution scaled by
`Quality.bloomScale`) -> custom `ShaderPass` applying vignette, film grain (skipped when
`Quality.grain` is false), and radial chromatic aberration that strengthens toward the edges.

- [ ] Step 1: Implement; route `Stage.render()` through the composer.
- [ ] Step 2: Browser-verify bloom on the wavefront and grain in the dark areas; check FPS
      has not collapsed.
- [ ] Step 3: Commit.

---

### Task 14: Liquid glass

**Files:** Create `src/ui/LiquidGlass.ts`, `src/styles/glass.css`

**Produces:** `installLiquidGlass(): { refraction: boolean }` — injects the SVG filter defs
(`feTurbulence` -> `feGaussianBlur` -> `feDisplacementMap`, plus channel offsets for the rim
chroma) into `#lg-defs`, feature-detects
`CSS.supports('backdrop-filter', 'url(#lg-displace)')`, and sets `.lg-refract` or
`.lg-fallback` on `<html>`.

`.lg-refract` uses `backdrop-filter: url(#lg-displace) blur(14px) saturate(180%)`.
`.lg-fallback` uses `backdrop-filter: blur(16px) saturate(180%)` only. Both get the
conic-gradient specular border, inner shadow, and top highlight.

- [ ] Step 1: Implement filter injection and CSS.
- [ ] Step 2: Browser-verify in Chrome that edges refract the scene behind them; then force
      `.lg-fallback` via `documentElement.className` and confirm the fallback still looks
      deliberate.
- [ ] Step 3: Commit.

---

### Task 15: Content and cards

**Files:** Create `src/content.ts`, `src/ui/Cards.ts`, `src/styles/cards.css`

**Consumes:** `Stage.camera`, `Loop`.
**Produces:** `interface Content { identity: {...}; projects: Project[]; links: Link[] }`;
`Cards { elements: HTMLElement[], update(dt) }` — projects each card's `anchor: Vector3`
through the camera and applies `translate3d`, with a per-card depth-scaled parallax offset.

Cards are focusable (`tabindex="0"`), have a focus ring independent of the glass, and are
`position: fixed` inside `#ui` with `pointer-events: auto` while `#ui` itself is
`pointer-events: none` so the canvas still receives pointer moves.

- [ ] Step 1: Write `content.ts` with placeholder copy for a staff front-end engineer.
- [ ] Step 2: Implement `Cards` and styles.
- [ ] Step 3: Browser-verify cards parallax with the world, text stays crisp, and the canvas
      still receives pointer events between cards.
- [ ] Step 4: Commit.

---

### Task 16: Card scan-in

**Files:** Create `src/ui/CardScan.ts`; modify `src/styles/cards.css`

**Consumes:** `Cards.elements`.
**Produces:** `CardScan { observe(el: HTMLElement, delay: number), triggerAll() }`

Per card: SVG rect border animated via `stroke-dashoffset`, a scan line element animated
top-to-bottom, text rows revealed via `clip-path: inset()`, and a chromatic split that
tracks the line. `IntersectionObserver` at `threshold: 0.25`. Reduced motion collapses this
to a 200ms opacity fade.

- [ ] Step 1: Implement.
- [ ] Step 2: Browser-verify the sweep runs once per card, on entry, staggered.
- [ ] Step 3: Commit.

---

### Task 17: Intro timeline

**Files:** Create `src/ui/Intro.ts`; modify `src/main.ts`

**Consumes:** `ScanReveal`, `ScanPulse`, `CardScan`, `Quality`, `Timeline`.
**Produces:** `Intro { update(dt), skip(), readonly done: boolean }`

Timeline per spec: 0.3s ignite, 0.3-3.2s radius eased outward, 2.4s cards begin staggered
scan-in, 3.6s idle. `click` and `keydown` call `skip()`. Reduced motion replaces the whole
sequence with a 400ms fade and an immediately full scan radius.

- [ ] Step 1: Implement, remove the temporary radius ramp from Task 7.
- [ ] Step 2: Browser-verify the full sequence, then verify skip works mid-intro, then verify
      reduced motion via emulation.
- [ ] Step 3: Commit.

---

### Task 18: Verification pass

**Files:** modify as defects require

- [ ] Step 1: `npx tsc --noEmit` — expected clean.
- [ ] Step 2: `npx vitest run` — expected all pass.
- [ ] Step 3: `npm run build` — expected clean, note bundle size.
- [ ] Step 4: Browser: load, read console, assert zero errors and zero WebGL warnings.
- [ ] Step 5: Browser: probe sustained FPS over 5 seconds via `requestAnimationFrame`
      sampling; record the number.
- [ ] Step 6: Browser: screenshot at intro t≈0.6s, t≈1.6s, t≈3.0s, and idle.
- [ ] Step 7: Browser: drive hover onto the cat proxy programmatically, assert the brain
      leaves `perch`.
- [ ] Step 8: Browser: resize to 375x812, screenshot, confirm no horizontal overflow.
- [ ] Step 9: Fix everything found, re-run steps 1-8 until clean. Commit.

---

### Task 19: GitHub repository and Pages

**Files:** Create `.github/workflows/deploy.yml`, `README.md`; modify `vite.config.ts`

- [ ] Step 1: Set `base: '/portfolio/'` in `vite.config.ts` for Pages path correctness.
- [ ] Step 2: Write the Actions workflow: checkout, setup-node 20, `npm ci`, `npm run build`,
      `actions/upload-pages-artifact`, `actions/deploy-pages`, with `pages: write` and
      `id-token: write` permissions.
- [ ] Step 3: Write `README.md` describing the effects and how to run it.
- [ ] Step 4: Commit.
- [ ] Step 5: **Confirm with the user**, then `gh repo create portfolio
      --public --source=. --remote=origin --push`.
- [ ] Step 6: Enable Pages via `gh api` with `build_type=workflow`; report the live URL.

---

## Self-Review

**Spec coverage:** intro scan → Tasks 6,7,8,17. Orbit parallax → Task 5. Particles → Tasks
9,10. Cat → Tasks 11,12. Liquid glass → Task 14. Card scan-on-load → Task 16. Performance
tiering → Task 3, applied in 9,10,13. Reduced motion → Tasks 5,16,17. Accessibility → Task
15. Testing → Tasks 2,3,6,12,18. Content → Task 15. Delivery → Task 19. No gaps.

**Type consistency:** `CatPose` is defined in Task 11 and consumed in Task 12. `BranchData`
is defined in Task 6 and consumed in Tasks 7 and 12. `Quality` field names are fixed in Task
3 and referenced by those exact names in Tasks 9, 10, 13. `ScanReveal.radius` is written by
Task 17 and read by Task 8.
