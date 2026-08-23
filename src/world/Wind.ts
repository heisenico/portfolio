/**
 * Vento gerado por arrastar a tela — o empurrão vira uma curva, não um
 * degrau.
 *
 * `push` só acumula; quem faz o vento nascer e morrer é `update`, que decai o
 * acumulado exponencialmente antes de derivar `strength` (sempre saturada em
 * 1, por mais que se empurre) e `vector` (a direção suavizada persegue o
 * empurrão bruto, não pula direto pra ele — é essa perseguição que faz o
 * vento virar de lado com um mínimo de inércia em vez de bater e voltar
 * instantâneo). `dt` é limitado antes de entrar em qualquer conta: uma aba
 * que volta do background entrega um `dt` de vários segundos, e sem o limite
 * o decaimento (`Math.exp(-DECAY * dt)`) zeraria tudo de um só golpe — ainda
 * correto, mas por acidente, não por design.
 */

import { Vector2 } from 'three'
import { clamp01, damp } from '../util/tween'

/** Decaimento por segundo do empurrão acumulado. */
const DECAY = 2.2
/** Velocidade com que a direção persegue o empurrão bruto. */
const DIRECTION_LAMBDA = 8
/** `dt` maior que isto é um salto (aba em segundo plano), não um frame. */
const MAX_DT = 1 / 10

export class Wind {
  /** Vento atual: direção suavizada, com magnitude igual a `strength`. */
  readonly vector = new Vector2()

  /** Empurrão bruto acumulado, nunca exposto: só a direção dele importa. */
  private raw = new Vector2()
  /** Direção suavizada — o que de fato persegue `raw`. */
  private direction = new Vector2()
  private _strength = 0

  /** 0..1 — quão forte o vento está agora. */
  get strength(): number {
    return this._strength
  }

  push(dx: number, dy: number): void {
    this.raw.x += dx
    this.raw.y += dy
  }

  update(dt: number): void {
    const clampedDt = Math.min(Math.max(dt, 0), MAX_DT)

    this.raw.multiplyScalar(Math.exp(-DECAY * clampedDt))
    this._strength = clamp01(this.raw.length())

    if (this.raw.lengthSq() > 1e-8) {
      const dirX = this.raw.x / this.raw.length()
      const dirY = this.raw.y / this.raw.length()
      this.direction.x = damp(this.direction.x, dirX, DIRECTION_LAMBDA, clampedDt)
      this.direction.y = damp(this.direction.y, dirY, DIRECTION_LAMBDA, clampedDt)
    }

    this.vector.set(this.direction.x * this._strength, this.direction.y * this._strength)
  }
}
