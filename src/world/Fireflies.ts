/**
 * Vagalumes que perseguem o ponteiro.
 *
 * Poucos de propósito: um enxame lê como poeira, um punhado lê como
 * criatura. Cada vagalume não persegue o ponteiro direto — persegue um alvo
 * próprio que por sua vez persegue o ponteiro, com o próprio atraso. É esse
 * atraso escalonado entre os vagalumes que faz o grupo convergir como um
 * bando puxado por trás, em vez de uma nuvem rígida grudada no cursor. Por
 * cima disso, um farfalhar de `curl3` garante que, parado o ponteiro, eles
 * continuem vivos em vez de congelar.
 *
 * Ao contrário dos motes — repelidos pelo ponteiro — estes são atraídos: é
 * esse par que faz a repulsão dos motes ler como escolha, não como física.
 *
 * A simulação roda na CPU, igual o `PointerTrail`: poucas dezenas de
 * partículas com estado próprio (posição, velocidade, alvo com atraso) não
 * valem a complexidade de levar tudo isso pro shader — ao contrário dos
 * motes, onde o volume só se paga rodando na GPU.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { Quality, Tier } from '../core/Quality'
import { firefliesFragment, firefliesVertex } from '../fx/shaders/fireflies'
import { curl3 } from '../util/noise'
import { mulberry32, randRange } from '../util/rng'
import { damp } from '../util/tween'
import { SCAN_EDGE_COLOR } from './ScanReveal'

/** Poucos de propósito — ver o comentário do arquivo. Chaveado por
 *  `initialTier`, não por `quality.allocation`: não há orçamento próprio
 *  pra vagalumes, e a contagem nunca muda depois de plantada. */
const COUNT_BY_TIER: Record<Tier, number> = { high: 60, moderate: 36, low: 18 }

/** Faixa de quão rápido o alvo pessoal de cada vagalume persegue o ponteiro
 *  de verdade. Sorteada por inseto — é essa faixa que dá o atraso
 *  escalonado que faz o bando convergir em vez de grudar tudo junto. */
const LAG_LAMBDA_MIN = 1.0
const LAG_LAMBDA_MAX = 3.2

/** Aceleração de perseguição do alvo com atraso. */
const PURSUE = 3.0
/** Força do farfalhar de curl noise. */
const WANDER_STRENGTH = 0.8
/** Frequência espacial amostrada pelo curl noise. */
const WANDER_FREQ = 0.25
/** Velocidade com que o campo de ruído evolui no tempo. */
const WANDER_TIME_FREQ = 0.15
/** Arrasto por segundo. Sem ele a perseguição vira mola descontrolada — é
 *  isto que "velocidade fortemente amortecida" quer dizer aqui. */
const DRAG = 3.5

/** Onde os vagalumes nascem antes do primeiro ponteiro de verdade chegar —
 *  perto de onde `Pointer.world` começa por padrão. Não depende da árvore:
 *  o construtor não recebe uma origem, só `quality`. */
const SPAWN_CENTER = new Vector3(0, 6, 0)
const SPAWN_RADIUS = 3

const SIZE = 6.5

export class Fireflies {
  readonly points: Points
  private material: ShaderMaterial
  private geometry: BufferGeometry
  private count: number

  private positions: Float32Array
  private velocities: Float32Array
  private lagTargets: Float32Array
  private lagLambdas: Float32Array

  private posAttr: BufferAttribute
  private wanderTmp = new Vector3()

  constructor(quality: Quality, color = SCAN_EDGE_COLOR) {
    this.count = COUNT_BY_TIER[quality.initialTier]
    const rng = mulberry32(4242)

    this.positions = new Float32Array(this.count * 3)
    this.velocities = new Float32Array(this.count * 3)
    this.lagTargets = new Float32Array(this.count * 3)
    this.lagLambdas = new Float32Array(this.count)

    const rates = new Float32Array(this.count)
    const phases = new Float32Array(this.count)

    for (let i = 0; i < this.count; i++) {
      const o = i * 3

      // Sorteio uniforme numa esfera em vez de num cubo — do contrário os
      // vagalumes nasceriam mais densos nos cantos.
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(rng() * 2 - 1)
      const r = Math.cbrt(rng()) * SPAWN_RADIUS
      const x = SPAWN_CENTER.x + r * Math.sin(phi) * Math.cos(theta)
      const y = SPAWN_CENTER.y + r * Math.cos(phi)
      const z = SPAWN_CENTER.z + r * Math.sin(phi) * Math.sin(theta)

      this.positions[o] = x
      this.positions[o + 1] = y
      this.positions[o + 2] = z
      this.lagTargets[o] = x
      this.lagTargets[o + 1] = y
      this.lagTargets[o + 2] = z

      this.lagLambdas[i] = randRange(rng, LAG_LAMBDA_MIN, LAG_LAMBDA_MAX)
      rates[i] = randRange(rng, 0.8, 2.2)
      phases[i] = rng() * Math.PI * 2
    }

    this.geometry = new BufferGeometry()
    this.posAttr = new BufferAttribute(this.positions, 3)
    this.posAttr.setUsage(35048 /* DynamicDrawUsage */)
    this.geometry.setAttribute('position', this.posAttr)
    this.geometry.setAttribute('aRate', new BufferAttribute(rates, 1))
    this.geometry.setAttribute('aPhase', new BufferAttribute(phases, 1))

    this.material = new ShaderMaterial({
      vertexShader: firefliesVertex,
      fragmentShader: firefliesFragment,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: SIZE },
        uDpr: { value: 1 },
        uColor: { value: new Color(color) },
        uOpacity: { value: 0.95 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    this.points = new Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  setDpr(dpr: number): void {
    this.material.uniforms['uDpr']!.value = dpr
  }

  update(dt: number, elapsed: number, pointerWorld: Vector3): void {
    this.material.uniforms['uTime']!.value = elapsed

    const drag = Math.exp(-DRAG * dt)

    for (let i = 0; i < this.count; i++) {
      const o = i * 3
      const lambda = this.lagLambdas[i]!

      // O alvo pessoal persegue o ponteiro com o próprio atraso — ver o
      // comentário do arquivo.
      this.lagTargets[o] = damp(this.lagTargets[o]!, pointerWorld.x, lambda, dt)
      this.lagTargets[o + 1] = damp(this.lagTargets[o + 1]!, pointerWorld.y, lambda, dt)
      this.lagTargets[o + 2] = damp(this.lagTargets[o + 2]!, pointerWorld.z, lambda, dt)

      const px = this.positions[o]!
      const py = this.positions[o + 1]!
      const pz = this.positions[o + 2]!

      curl3(
        px * WANDER_FREQ,
        py * WANDER_FREQ + elapsed * WANDER_TIME_FREQ,
        pz * WANDER_FREQ,
        this.wanderTmp,
      )

      const ax = (this.lagTargets[o]! - px) * PURSUE + this.wanderTmp.x * WANDER_STRENGTH
      const ay = (this.lagTargets[o + 1]! - py) * PURSUE + this.wanderTmp.y * WANDER_STRENGTH
      const az = (this.lagTargets[o + 2]! - pz) * PURSUE + this.wanderTmp.z * WANDER_STRENGTH

      // Arrasto forte antes de somar a força: sem ele a perseguição vira uma
      // mola que ultrapassa o alvo e oscila, em vez de convergir suave.
      this.velocities[o] = this.velocities[o]! * drag + ax * dt
      this.velocities[o + 1] = this.velocities[o + 1]! * drag + ay * dt
      this.velocities[o + 2] = this.velocities[o + 2]! * drag + az * dt

      this.positions[o] = px + this.velocities[o]! * dt
      this.positions[o + 1] = py + this.velocities[o + 1]! * dt
      this.positions[o + 2] = pz + this.velocities[o + 2]! * dt
    }

    this.posAttr.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
