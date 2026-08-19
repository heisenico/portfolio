/**
 * The visible wavefront.
 *
 * The branch shader already reveals geometry at the right radius, but on sparse
 * line geometry that reads as scattered bright points rather than a front. This
 * draws the shell itself: an expanding sphere rendered from the inside with a
 * fresnel rim, so it reads as a surface passing through the scene rather than a
 * ball growing inside it.
 */

import {
  AdditiveBlending,
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { pulseFragment, pulseVertex } from '../fx/shaders/pulse'

export class ScanPulse {
  readonly mesh: Mesh
  private material: ShaderMaterial

  constructor(origin: Vector3, color = 0x8ceaff) {
    // Unit sphere, scaled per frame — one geometry for every radius.
    const geometry = new SphereGeometry(1, 48, 32)

    this.material = new ShaderMaterial({
      vertexShader: pulseVertex,
      fragmentShader: pulseFragment,
      uniforms: {
        uColor: { value: new Color(color) },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      // Drawing the far side means the shell is seen from inside once the
      // camera is enclosed, which keeps it visible for the whole sweep.
      side: BackSide,
    })

    this.mesh = new Mesh(geometry, this.material)
    this.mesh.position.copy(origin)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
  }

  /**
   * @param radius current wavefront radius
   * @param progress 0..1 across the whole sweep — the shell fades out as the
   *        front leaves the tree, so it never lingers as a dome over the scene
   */
  update(_dt: number, elapsed: number, radius: number, progress: number): void {
    this.mesh.scale.setScalar(Math.max(radius, 0.001))
    this.material.uniforms['uTime']!.value = elapsed

    // Ignite fast, hold, then fade as the front runs out past the branches.
    const ignite = Math.min(progress / 0.06, 1)
    const fade = 1 - Math.max(0, (progress - 0.55) / 0.45)
    // The shell is a cue, not the subject — it must never out-read the tree.
    this.material.uniforms['uOpacity']!.value = ignite * fade * fade * 0.62
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
