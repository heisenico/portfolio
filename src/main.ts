import './styles/base.css'

import { BoxGeometry, Mesh, MeshBasicMaterial, TorusKnotGeometry } from 'three'
import { CameraRig } from './core/CameraRig'
import { Loop } from './core/Loop'
import { Pointer } from './core/Pointer'
import { Quality } from './core/Quality'
import { Stage } from './core/Stage'

const canvas = document.getElementById('stage') as HTMLCanvasElement

const quality = new Quality()
const stage = new Stage(canvas, quality)
const loop = new Loop()
const pointer = new Pointer(stage.camera)
const rig = new CameraRig(stage.camera, pointer, quality)

// TEMPORARY (removed in the branch task): reference geometry at three depths so
// parallax separation is visible before the tree exists.
const refs: Mesh[] = []
for (let i = 0; i < 3; i++) {
  const m = new Mesh(
    i === 1 ? new TorusKnotGeometry(2, 0.5, 80, 12) : new BoxGeometry(2, 2, 2),
    new MeshBasicMaterial({ color: 0x7fe9ff, wireframe: true }),
  )
  m.position.set((i - 1) * 7, 6.5, (i - 1) * 9)
  stage.scene.add(m)
  refs.push(m)
}

loop.add((dt) => pointer.update(dt))
loop.add((dt, elapsed) => rig.update(dt, elapsed))
loop.add(() => quality.sample(loop.frameMs))
loop.add(() => stage.renderDefault())

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
