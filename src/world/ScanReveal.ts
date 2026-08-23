/**
 * Turns branch buffers into the two drawn layers — wireframe lines and scan
 * markers — and owns the wavefront radius they both read.
 *
 * The radius is set from outside (by `Intro` during the opening, and pinned at
 * max afterwards). This class does not decide when the scan happens; it only
 * knows how to draw any given moment of it.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
} from 'three'
import { branchFragment, branchVertex } from '../fx/shaders/branch'
import { markerFragment, markerVertex } from '../fx/shaders/marker'
import type { BranchData } from './BranchSystem'

/** Width of the bright leading band, in world units. */
const BAND = 2.6
/** Brightness the wireframe settles to once the wavefront has passed. */
const REST_INTENSITY = 0.46
/** Distance over which a marker completes its pop-in. */
const POP_DISTANCE = 1.4
/** Distance over which a marker fades from hot to resting. */
const SETTLE_DISTANCE = 4.0
const MARKER_REST_ALPHA = 0.42

export const SCAN_REST_COLOR = 0x4fe08f
export const SCAN_EDGE_COLOR = 0xd9ffe9

export class ScanReveal {
  readonly group = new Group()
  readonly maxRadius: number

  private lines: LineSegments
  private markers: Mesh
  private lineMaterial: ShaderMaterial
  private markerMaterial: ShaderMaterial
  private currentRadius = 0

  constructor(private data: BranchData, maxDepth = 6) {
    this.maxRadius = data.bounds + BAND * 2

    const lineGeometry = new BufferGeometry()
    lineGeometry.setAttribute('position', new BufferAttribute(data.positions, 3))
    lineGeometry.setAttribute('aDist', new BufferAttribute(data.distances, 1))
    lineGeometry.setAttribute('aDepth', new BufferAttribute(data.depths, 1))
    lineGeometry.setAttribute('aBranchId', new BufferAttribute(data.branchIds, 1))

    this.lineMaterial = new ShaderMaterial({
      vertexShader: branchVertex,
      fragmentShader: branchFragment,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uScanRadius: { value: 0 },
          uBand: { value: BAND },
          uRest: { value: REST_INTENSITY },
          uMaxDepth: { value: maxDepth },
          uTime: { value: 0 },
          uRestColor: { value: new Color(SCAN_REST_COLOR) },
          uEdgeColor: { value: new Color(SCAN_EDGE_COLOR) },
          uOpacity: { value: 1 },
          uGain: { value: 1.35 },
          uHotGain: { value: 3.1 },
          // -1 means "nothing singled out".
          uLitBranch: { value: -1 },
          uWind: { value: new Vector2() },
          uWindTime: { value: 0 },
        },
      ]),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: true,
    })

    this.lines = new LineSegments(lineGeometry, this.lineMaterial)
    this.lines.frustumCulled = false

    const markerGeometry = new InstancedBufferGeometry()
    const quad = new PlaneGeometry(1, 1)
    markerGeometry.index = quad.index
    markerGeometry.attributes['position'] = quad.attributes['position']!
    markerGeometry.attributes['uv'] = quad.attributes['uv']!
    markerGeometry.instanceCount = data.markerCount
    markerGeometry.setAttribute('aOffset', new InstancedBufferAttribute(data.markerOffsets, 3))
    markerGeometry.setAttribute('aScale', new InstancedBufferAttribute(data.markerScales, 1))
    markerGeometry.setAttribute('aDist', new InstancedBufferAttribute(data.markerDistances, 1))
    markerGeometry.setAttribute('aSeed', new InstancedBufferAttribute(data.markerSeeds, 1))
    quad.dispose()

    // Deliberately no uWind/uWindTime here: markers sit on the geometry they
    // were generated from (the unbent line positions), so bending one layer
    // and not the other would separate a marker from the branch it decorates.
    // The alternative — duplicating the bend into markerVertex too — buys
    // correctness for a handful of pixels at the cost of a second shader; a
    // known, accepted limitation.
    this.markerMaterial = new ShaderMaterial({
      vertexShader: markerVertex,
      fragmentShader: markerFragment,
      uniforms: {
        uScanRadius: { value: 0 },
        uPopDistance: { value: POP_DISTANCE },
        uSettleDistance: { value: SETTLE_DISTANCE },
        uRestAlpha: { value: MARKER_REST_ALPHA },
        uTime: { value: 0 },
        uRestColor: { value: new Color(SCAN_REST_COLOR) },
        uEdgeColor: { value: new Color(SCAN_EDGE_COLOR) },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    this.markers = new Mesh(markerGeometry, this.markerMaterial)
    this.markers.frustumCulled = false

    this.group.add(this.lines, this.markers)
    this.setRadius(0)
  }

  /** Single out one branch, or `null` to clear. */
  setLitBranch(id: number | null): void {
    this.lineMaterial.uniforms['uLitBranch']!.value = id ?? -1
  }

  setRadius(radius: number): void {
    this.currentRadius = radius
    this.lineMaterial.uniforms['uScanRadius']!.value = radius
    this.markerMaterial.uniforms['uScanRadius']!.value = radius
  }

  /** Only the wireframe bends — see the comment by `markerMaterial`. */
  setWind(vector: Vector2, time: number): void {
    this.lineMaterial.uniforms['uWind']!.value.copy(vector)
    this.lineMaterial.uniforms['uWindTime']!.value = time
  }

  get radius(): number {
    return this.currentRadius
  }

  /** 0 before the scan starts, 1 once the wavefront has cleared the tree. */
  get progress(): number {
    return Math.min(this.currentRadius / this.maxRadius, 1)
  }

  update(_dt: number, elapsed: number): void {
    this.lineMaterial.uniforms['uTime']!.value = elapsed
    this.markerMaterial.uniforms['uTime']!.value = elapsed
  }

  get perches() {
    return this.data.perches
  }

  dispose(): void {
    this.lines.geometry.dispose()
    this.markers.geometry.dispose()
    this.lineMaterial.dispose()
    this.markerMaterial.dispose()
  }
}
