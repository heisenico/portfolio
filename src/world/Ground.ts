/**
 * Ground plane.
 *
 * A radial grid rather than a square one: rings and spokes centred under the
 * tree put the densest lines where the eye already is, and the whole thing
 * dissolves into fog well before its edge so the scene has no visible horizon.
 * It is revealed by the same scan radius as the branches.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  type Vector3,
} from 'three'
import { groundFragment, groundVertex } from '../fx/shaders/ground'

const RINGS = 16
const SPOKES = 48
const RADIUS = 34
const SEGMENTS_PER_RING = 96

export class Ground {
  readonly mesh: LineSegments
  private material: ShaderMaterial

  constructor(origin: Vector3, y = -2.6, color = 0x2f9c6a) {
    const positions: number[] = []
    const distances: number[] = []
    const radii: number[] = []

    const push = (x: number, z: number) => {
      positions.push(x, y, z)
      distances.push(Math.hypot(x - origin.x, y - origin.y, z - origin.z))
      radii.push(Math.hypot(x, z))
    }

    // Concentric rings, spaced quadratically so they crowd toward the horizon.
    for (let r = 1; r <= RINGS; r++) {
      const radius = RADIUS * Math.pow(r / RINGS, 1.6)
      for (let s = 0; s < SEGMENTS_PER_RING; s++) {
        const a0 = (s / SEGMENTS_PER_RING) * Math.PI * 2
        const a1 = ((s + 1) / SEGMENTS_PER_RING) * Math.PI * 2
        push(Math.cos(a0) * radius, Math.sin(a0) * radius)
        push(Math.cos(a1) * radius, Math.sin(a1) * radius)
      }
    }

    // Spokes, starting outside the trunk so they do not converge into a blob.
    for (let s = 0; s < SPOKES; s++) {
      const a = (s / SPOKES) * Math.PI * 2
      const c = Math.cos(a)
      const sn = Math.sin(a)
      push(c * 2.2, sn * 2.2)
      push(c * RADIUS, sn * RADIUS)
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('aDist', new BufferAttribute(new Float32Array(distances), 1))
    geometry.setAttribute('aRadius', new BufferAttribute(new Float32Array(radii), 1))

    this.material = new ShaderMaterial({
      vertexShader: groundVertex,
      fragmentShader: groundFragment,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uScanRadius: { value: 0 },
          uBand: { value: 3.2 },
          uTime: { value: 0 },
          uColor: { value: new Color(color) },
          uFadeRadius: { value: RADIUS * 0.72 },
          uOpacity: { value: 1 },
        },
      ]),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: true,
    })

    this.mesh = new LineSegments(geometry, this.material)
    this.mesh.frustumCulled = false
  }

  update(_dt: number, elapsed: number, scanRadius: number): void {
    this.material.uniforms['uTime']!.value = elapsed
    this.material.uniforms['uScanRadius']!.value = scanRadius
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
