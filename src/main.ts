import './styles/base.css'

import { Vector3 } from 'three'
import { CameraRig } from './core/CameraRig'
import { Loop } from './core/Loop'
import { Pointer } from './core/Pointer'
import { Quality } from './core/Quality'
import { Stage } from './core/Stage'
import { Post } from './fx/Post'
import { generateBranches } from './world/BranchSystem'
import { Ground } from './world/Ground'
import { ScanPulse } from './world/ScanPulse'
import { ScanReveal } from './world/ScanReveal'

const canvas = document.getElementById('stage') as HTMLCanvasElement

/** `?verify` makes the canvas capturable by external screenshot tooling. */
const VERIFY = new URLSearchParams(location.search).has('verify')

const quality = new Quality()
const stage = new Stage(canvas, quality, { preserveDrawingBuffer: VERIFY })
const loop = new Loop()
const pointer = new Pointer(stage.camera)
const rig = new CameraRig(stage.camera, pointer, quality)

const SCAN_ORIGIN = new Vector3(0, 6.5, 0)
const TREE_DEPTH = 6

const branches = generateBranches({ origin: SCAN_ORIGIN, depth: TREE_DEPTH })
const scan = new ScanReveal(branches, TREE_DEPTH)
const pulse = new ScanPulse(SCAN_ORIGIN)
const ground = new Ground(SCAN_ORIGIN)
stage.scene.add(scan.group, pulse.mesh, ground.mesh)

// TEMPORARY (replaced by Intro): ramp the wavefront so the reveal is visible.
let scanClock = 0
let scanFrozen = false
const SCAN_DURATION = 2.9

const post = new Post(stage, quality)

// Frame the tree from its real extent, and refit whenever the viewport changes.
rig.frame(new Vector3(0, branches.centreY, 0), branches.halfWidth, branches.halfHeight)
stage.onResize(() => rig.refit())

loop.add((dt) => pointer.update(dt))
loop.add((dt, elapsed) => rig.update(dt, elapsed))
loop.add((dt, elapsed) => {
  if (!scanFrozen) {
    scanClock = Math.min(scanClock + dt, SCAN_DURATION)
    const t = scanClock / SCAN_DURATION
    scan.setRadius(scan.maxRadius * (1 - Math.pow(1 - t, 3)))
  }
  scan.update(dt, elapsed)
  pulse.update(dt, elapsed, scan.radius, scan.progress)
  ground.update(dt, elapsed, scan.radius)
})
loop.add(() => quality.sample(loop.frameMs))
loop.add((dt, elapsed) => post.render(dt, elapsed))

loop.start()
document.documentElement.classList.remove('is-booting')
document.getElementById('veil')?.classList.add('is-lifted')

// Exposed for browser-driven verification.
/**
 * Verification handle. `step` advances the world deterministically so a driver
 * can screenshot an exact moment in a timeline instead of racing the clock.
 */
;(window as unknown as Record<string, unknown>).__world = {
  stage,
  quality,
  pointer,
  rig,
  loop,
  post,
  scan,
  pulse,
  ground,
  branches,
  /**
   * Copy the current drawing buffer into a DOM image over the page.
   *
   * External screen capture reads the compositor, which serves a stale frame
   * for a WebGL canvas — verified: the GL buffer held a gated scan while the
   * capture showed a completed one. An <img> is composited normally, so this
   * is the only capture path that reflects the frame actually rendered.
   * Requires `?verify` for preserveDrawingBuffer.
   */
  snap() {
    let img = document.getElementById('__snap') as HTMLImageElement | null
    if (!img) {
      img = document.createElement('img')
      img.id = '__snap'
      Object.assign(img.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        zIndex: '9999',
      })
      document.body.appendChild(img)
    }
    img.src = canvas.toDataURL('image/png')
    return img.src.length
  },
  unsnap() {
    document.getElementById('__snap')?.remove()
  },
  /** Pin the wavefront at a fraction of its travel and redraw, for inspection. */
  freezeScan(progress: number) {
    scanFrozen = true
    scan.setRadius(scan.maxRadius * progress)
    pulse.update(0, loop.elapsed, scan.radius, scan.progress)
    ground.update(0, loop.elapsed, scan.radius)
    post.render(0, loop.elapsed)
  },
  step(dt = 1 / 60, frames = 1) {
    for (let i = 0; i < frames; i++) loop.stepManual(dt)
  },
  /** Render cost in ms, measured synchronously so it survives a hidden tab. */
  measure(samples = 40) {
    const gl = stage.renderer.getContext()
    stage.renderDefault()
    gl.finish()
    const t0 = performance.now()
    for (let i = 0; i < samples; i++) stage.renderDefault()
    gl.finish()
    return (performance.now() - t0) / samples
  },
}
