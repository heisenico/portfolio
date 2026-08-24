/**
 * The cat's body.
 *
 * Assembled from primitives, and deliberately dumb: it holds no timers and no
 * state, and `setPose` is a pure function of the pose it is handed. Everything
 * about *when* the cat does anything lives in `CatBrain`.
 *
 * Local space has the cat facing +Z with its feet at y = 0, so `CatBrain` can
 * position it on the ground or a branch without knowing anything about the
 * model's internals.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  UniformsLib,
  UniformsUtils,
  type BufferGeometry,
} from 'three'
import { catFragment, catVertex } from '../fx/shaders/cat'
import type { Tema } from '../core/Quality'
import type { CatPose } from './CatPose'
import { AMBER, AMBER_INVERTIDO, INK, PAPER } from './palette'

/** Height of the hips above the feet when standing. */
const STAND_HEIGHT = 0.66
/** Hip to foot. Must equal STAND_HEIGHT minus the hip inset, or the feet
 * punch through the ground the cat is standing on. */
const LEG_LENGTH = 0.48
const HIP_INSET = 0.18
const TAIL_SEGMENTS = 8
const TAIL_SEGMENT_LENGTH = 0.16

/**
 * Layer própria. No papel, `Post` tira o gato da passada principal e o
 * desenha depois do bloom: um corpo claro pré-inversão é a maior área
 * brilhante da cena, e o bloom o transformaria numa mancha escura no papel.
 * O `proxy` de hover fica na layer 0 — o raycaster só olha lá.
 */
export const CAT_LAYER = 1

export class Cat {
  readonly group = new Group()
  /** Forgiving hover target. Raycasting the assembled parts is far too fussy. */
  readonly proxy: Mesh

  private body = new Group()
  private legs: Object3D[] = []
  private tailBones: Object3D[] = []
  private ears: Object3D[] = []
  private head = new Group()
  private material: ShaderMaterial
  private edgeMaterial: LineBasicMaterial

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader: catVertex,
      fragmentShader: catFragment,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uColor: { value: new Color(PAPER) },
          uRim: { value: new Color(AMBER) },
          uOpacity: { value: 0 },
          uTime: { value: 0 },
        },
      ]),
      transparent: true,
      depthWrite: true,
      fog: true,
    })

    this.edgeMaterial = new LineBasicMaterial({
      color: new Color(AMBER),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    this.buildBody()
    this.buildLegs()
    this.buildTail()

    this.group.add(this.body)

    this.proxy = new Mesh(
      new SphereGeometry(0.95, 8, 6),
      new MeshBasicMaterial({ visible: false }),
    )
    this.proxy.position.set(0, STAND_HEIGHT, 0.1)
    this.group.add(this.proxy)

    // The model is authored at roughly life size relative to the tree, but the
    // tree is framed whole, so at that scale the cat is a few dozen pixels and
    // its silhouette cannot read. Oversized deliberately.
    this.group.scale.setScalar(1.7)
    this.group.visible = false
  }

  /** Mesh plus its silhouette, which is what actually makes the shape read. */
  private part(geometry: BufferGeometry): Group {
    const holder = new Group()
    const mesh = new Mesh(geometry, this.material)
    const edges = new LineSegments(new EdgesGeometry(geometry, 24), this.edgeMaterial)
    mesh.layers.set(CAT_LAYER)
    edges.layers.set(CAT_LAYER)
    holder.add(mesh, edges)
    return holder
  }

  private buildBody(): void {
    // Proportions matter more than detail at the size this renders. A cat is
    // long and low with a small head; an over-large head made the whole model
    // read as a blob with ears.
    const torso = this.part(new SphereGeometry(0.4, 14, 10))
    torso.scale.set(0.72, 0.66, 1.78)
    torso.position.set(0, STAND_HEIGHT, -0.02)
    this.body.add(torso)

    const haunch = this.part(new SphereGeometry(0.29, 12, 9))
    haunch.scale.set(0.98, 1.0, 0.92)
    haunch.position.set(0, STAND_HEIGHT + 0.05, -0.46)
    this.body.add(haunch)

    const shoulder = this.part(new SphereGeometry(0.24, 12, 9))
    shoulder.scale.set(0.94, 0.94, 1.02)
    shoulder.position.set(0, STAND_HEIGHT + 0.03, 0.44)
    this.body.add(shoulder)

    const neck = this.part(new SphereGeometry(0.13, 8, 6))
    neck.position.set(0, STAND_HEIGHT + 0.16, 0.62)
    this.body.add(neck)

    // Head group, so it can tilt independently of the spine.
    const skull = this.part(new IcosahedronGeometry(0.17, 0))
    skull.scale.set(1.0, 0.95, 1.08)
    this.head.add(skull)

    const muzzle = this.part(new ConeGeometry(0.075, 0.15, 6))
    muzzle.rotation.x = Math.PI / 2
    muzzle.position.set(0, -0.05, 0.15)
    this.head.add(muzzle)

    for (const side of [-1, 1]) {
      const ear = this.part(new ConeGeometry(0.065, 0.15, 4))
      ear.position.set(side * 0.1, 0.16, -0.01)
      ear.rotation.z = side * -0.16
      this.head.add(ear)
      this.ears.push(ear)
    }

    this.head.position.set(0, STAND_HEIGHT + 0.32, 0.74)
    this.body.add(this.head)
  }

  private buildLegs(): void {
    // front-left, front-right, back-left, back-right
    const offsets: [number, number][] = [
      [-0.18, 0.44],
      [0.18, 0.44],
      [-0.21, -0.44],
      [0.21, -0.44],
    ]

    for (const [x, z] of offsets) {
      const leg = this.part(new BoxGeometry(0.115, LEG_LENGTH, 0.14))
      // Pivot at the hip: shift the geometry down so scaling the group
      // shortens the leg from the hip rather than from its centre.
      leg.children.forEach((child) => {
        child.position.y = -LEG_LENGTH / 2
      })
      leg.position.set(x, STAND_HEIGHT - HIP_INSET, z)
      this.body.add(leg)
      this.legs.push(leg)
    }
  }

  private buildTail(): void {
    let parent: Object3D = this.body
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const bone = new Group()
      const taper = 1 - (i / TAIL_SEGMENTS) * 0.62
      const segment = this.part(new BoxGeometry(0.085 * taper, 0.085 * taper, TAIL_SEGMENT_LENGTH))
      segment.position.z = -TAIL_SEGMENT_LENGTH / 2
      bone.add(segment)

      if (i === 0) {
        bone.position.set(0, STAND_HEIGHT + 0.16, -0.66)
      } else {
        bone.position.z = -TAIL_SEGMENT_LENGTH
      }

      parent.add(bone)
      parent = bone
      this.tailBones.push(bone)
    }
  }

  /**
   * No papel o frame é invertido, então o gato recebe o negativo do que deve
   * aparecer: corpo `INK` (sai preto), forro `AMBER_INVERTIDO` (sai #ffc27a),
   * arestas `INK` (saem tinta). Na noite, o que sempre foi.
   */
  setTema(tema: Tema): void {
    const papel = tema === 'papel'
    ;(this.material.uniforms['uColor']!.value as Color).setHex(papel ? INK : PAPER)
    ;(this.material.uniforms['uRim']!.value as Color).setHex(papel ? AMBER_INVERTIDO : AMBER)
    this.edgeMaterial.color.setHex(papel ? INK : AMBER)
  }

  setPose(pose: CatPose): void {
    this.group.visible = pose.visible
    if (!pose.visible) return

    this.material.uniforms['uOpacity']!.value = pose.opacity
    this.edgeMaterial.opacity = pose.opacity * 0.5

    this.group.position.copy(pose.position)
    this.group.rotation.y = pose.facing

    // Crouch drops the hips and folds the legs by the same amount, so the feet
    // stay planted on the ground instead of sinking through it.
    const drop = pose.crouch * 0.34
    this.body.position.y = -drop

    // Squash is volume-preserving enough to read: wider and shorter when
    // compressed, longer and thinner when stretched along the direction of
    // travel (local +Z).
    this.body.scale.set(
      1 + pose.squash * 0.2,
      1 - pose.squash * 0.3,
      1 - pose.squash * 0.34,
    )

    const legScale = Math.max(0.25, 1 - pose.crouch * 0.62)
    for (const leg of this.legs) {
      leg.scale.y = legScale
      leg.position.y = STAND_HEIGHT - HIP_INSET + drop
    }

    // Tail: a travelling wave down the chain, amplified while balancing.
    const amplitude = 0.16 + pose.balance * 0.3
    for (let i = 0; i < this.tailBones.length; i++) {
      const bone = this.tailBones[i]!
      const phase = pose.tailPhase - i * 0.55
      bone.rotation.y = Math.sin(phase) * amplitude
      bone.rotation.x =
        i === 0
          ? 0.5 - pose.crouch * 0.7 + Math.cos(phase * 0.7) * 0.1
          : Math.cos(phase) * amplitude * 0.6
    }

    // Ears pin back as the cat gets alert.
    for (let i = 0; i < this.ears.length; i++) {
      const ear = this.ears[i]!
      ear.rotation.x = -pose.earPerk * 0.7
      ear.rotation.z = (i === 0 ? -1 : 1) * (0.18 + pose.earPerk * 0.25)
    }

    this.head.rotation.x = -pose.crouch * 0.25 + pose.balance * 0.12
  }

  update(_dt: number, elapsed: number): void {
    this.material.uniforms['uTime']!.value = elapsed
  }

  dispose(): void {
    this.material.dispose()
    this.edgeMaterial.dispose()
    this.group.traverse((o) => {
      const withGeometry = o as Partial<Mesh>
      withGeometry.geometry?.dispose()
    })
  }
}
