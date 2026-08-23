/**
 * Pointer-driven orbit, which is the whole parallax effect.
 *
 * Not OrbitControls: that requires a drag to do anything, and the world should
 * respond to a pointer that is merely present. The camera rides a fixed-radius
 * shell around the scene focus, its angles damped toward pointer-derived
 * targets, with a slow Lissajous drift summed underneath so the scene keeps
 * breathing when the pointer is still. Dragging widens the same range rather
 * than switching to a different control scheme.
 */

import { Vector3, type PerspectiveCamera } from 'three'
import { clamp01, damp, easeInOutCubic } from '../util/tween'
import type { Pointer } from './Pointer'
import type { Quality } from './Quality'
import type { BranchRecord } from '../world/BranchSystem'

/** Angular reach of pointer parallax, in radians. */
const AZIMUTH_RANGE = 0.42
const POLAR_RANGE = 0.2
/** Dragging pushes past the hover range without changing the feel. */
const DRAG_GAIN = 2.4
const DRIFT_AZIMUTH = 0.055
const DRIFT_POLAR = 0.032
/** Reduced motion keeps parallax legible but drops it well below vestibular range. */
const REDUCED_SCALE = 0.3

/**
 * Margin applied to the subject's half-extents. 1.0 fits it exactly to the
 * frame edge; above 1 leaves air around it.
 *
 * Fitting a bounding *sphere* instead over-tightens the vertical, because a
 * tree's diagonal is much larger than its half-height — that cropped the
 * canopy on every viewport.
 */
const FIT_MARGIN = 1.06
const MIN_RADIUS = 12
const MAX_RADIUS = 60

/** Quanto a órbita cresce da primeira à última linha da página. */
const DOLLY_GANHO = 0.22
/** Quanto o ponto de mira sobe, em unidades de mundo. */
const DOLLY_SUBIDA = 2.2

/**
 * Resposta da câmera à rolagem.
 *
 * A árvore recua e o olhar sobe conforme o leitor desce. Devagar e pouco: é
 * pra parecer que a página tem profundidade, não que a câmera está num trilho.
 * Puro e testado à parte porque a curva é a decisão, e o resto é encanamento.
 */
export function scrollDolly(t: number): { ganhoRaio: number; subida: number } {
  const e = easeInOutCubic(clamp01(t))
  return { ganhoRaio: 1 + DOLLY_GANHO * e, subida: DOLLY_SUBIDA * e }
}

export interface Enquadramento {
  focus: Vector3
  halfWidth: number
  halfHeight: number
}

/**
 * Interpolação linear entre dois enquadramentos.
 *
 * Linear de propósito: a suavização é aplicada no `t` antes de chamar isto, o
 * que deixa a curva ser escolhida por quem chama e deixa esta função ter um
 * teste que diz uma coisa só.
 */
export function computeFlight(de: Enquadramento, para: Enquadramento, t: number): Enquadramento {
  const k = clamp01(t)
  return {
    focus: de.focus.clone().lerp(para.focus, k),
    halfWidth: de.halfWidth + (para.halfWidth - de.halfWidth) * k,
    halfHeight: de.halfHeight + (para.halfHeight - de.halfHeight) * k,
  }
}

/**
 * Menor diferença angular, dentro de ±π.
 *
 * Sem isso, um voo de 170° pra -170° gira 340° pelo caminho longo — a câmera
 * dá quase uma volta inteira em torno da árvore pra chegar num galho que
 * estava logo ali.
 */
export function shortestAngle(de: number, para: number): number {
  const volta = Math.PI * 2
  let d = (para - de) % volta
  if (d > Math.PI) d -= volta
  if (d < -Math.PI) d += volta
  return d
}

export class CameraRig {
  readonly focus = new Vector3(0, 7.4, 0)
  radius = 21

  private halfWidth = 8
  private halfHeight = 10
  /**
   * World-space nudge applied to the look-at point, to clear room for text.
   *
   * Wide screens get a horizontal push: moving the focus left puts the tree on
   * the right and leaves a column for the headline. Narrow screens have no
   * column to clear, so the push goes vertical instead — raising the focus
   * drops the tree into the lower half, under the text rather than behind it.
   * Dimming the tree to win that contrast was the wrong trade: it cost the
   * whole image to save three lines of type.
   */
  private shiftX = 0
  private shiftY = 0

  private azimuth = 0
  private polar = 0
  private gain = 1
  private drift = 0
  private scroll = 0
  private scrollTarget = 0

  /**
   * Azimute de repouso. O paralaxe do ponteiro monta em cima disto, então
   * mudar a base gira o mundo inteiro sem mexer em como ele responde à mão.
   */
  private baseAzimuth = 0
  private baseAzimuthDe = 0
  private baseAzimuthPara = 0
  private flight: { de: Enquadramento; para: Enquadramento; t: number; dur: number } | null = null

  constructor(
    private camera: PerspectiveCamera,
    private pointer: Pointer,
    private quality: Quality,
  ) {}

  /**
   * Set the subject to keep in frame. The distance is then derived from the
   * camera's own field of view and aspect, so framing survives any viewport —
   * a hardcoded distance crops the canopy on a portrait phone and strands the
   * tree in the middle of an ultrawide.
   */
  frame(focus: Vector3, halfWidth: number, halfHeight: number): void {
    this.focus.copy(focus)
    this.halfWidth = halfWidth
    this.halfHeight = halfHeight
    this.refit()
  }

  /** Recompute the orbit distance. Call whenever the projection changes. */
  refit(): void {
    const wide = this.camera.aspect > 1.15
    this.shiftX = wide ? -this.halfWidth * 0.42 : 0
    this.shiftY = wide ? 0 : this.halfHeight * 0.28

    const vFov = (this.camera.fov * Math.PI) / 180
    const hHalfAngle = Math.atan(Math.tan(vFov / 2) * this.camera.aspect)

    // Distance at which each axis exactly fills its half-angle; take whichever
    // is further so both fit.
    const distance = Math.max(
      (this.halfHeight * FIT_MARGIN) / Math.tan(vFov / 2),
      (this.halfWidth * FIT_MARGIN) / Math.tan(hHalfAngle),
    )
    this.radius = Math.min(Math.max(distance, MIN_RADIUS), MAX_RADIUS)
  }

  /** Enquadramento atual, copiado — quem recebe pode guardar sem alias. */
  private get enquadramento(): Enquadramento {
    return {
      focus: this.focus.clone(),
      halfWidth: this.halfWidth,
      halfHeight: this.halfHeight,
    }
  }

  private partir(para: Enquadramento, azimute: number, seconds: number): void {
    const dur = this.quality.reducedMotion ? 0 : seconds

    this.baseAzimuthDe = this.baseAzimuth
    this.baseAzimuthPara = azimute

    if (dur <= 0) {
      // Movimento reduzido não ganha uma versão lenta do voo: ganha o destino.
      this.focus.copy(para.focus)
      this.halfWidth = para.halfWidth
      this.halfHeight = para.halfHeight
      this.baseAzimuth = azimute
      this.flight = null
      this.refit()
      return
    }

    this.flight = { de: this.enquadramento, para, t: 0, dur }
  }

  flyTo(focus: Vector3, halfWidth: number, halfHeight: number, seconds: number): void {
    this.partir({ focus: focus.clone(), halfWidth, halfHeight }, 0, seconds)
  }

  /**
   * Emoldura um galho de lado.
   *
   * O ponto de mira é o meio do galho e a meia-extensão é metade do
   * comprimento dele, com uma folga pra ele não encostar na borda. O azimute
   * de repouso fica perpendicular à direção do galho — olhar na direção do
   * eixo dele enquadraria um ponto.
   */
  flyAlongBranch(branch: BranchRecord, seconds: number): void {
    const meio = branch.start.clone().add(branch.tip).multiplyScalar(0.5)
    const meia = Math.max(branch.length * 0.62, 1.4)
    const azimute = Math.atan2(branch.along.x, branch.along.z) + Math.PI / 2
    this.partir({ focus: meio, halfWidth: meia, halfHeight: meia }, azimute, seconds)
  }

  get flying(): boolean {
    return this.flight !== null
  }

  /** 0 no topo da página, 1 no fim. Amortecido; pode ser chamado por frame. */
  setScroll(t: number): void {
    this.scrollTarget = clamp01(t)
  }

  update(dt: number, elapsed: number): void {
    if (this.flight) {
      this.flight.t = Math.min(this.flight.t + dt / this.flight.dur, 1)
      const k = easeInOutCubic(this.flight.t)
      const q = computeFlight(this.flight.de, this.flight.para, k)
      this.focus.copy(q.focus)
      this.halfWidth = q.halfWidth
      this.halfHeight = q.halfHeight
      this.baseAzimuth =
        this.baseAzimuthDe + shortestAngle(this.baseAzimuthDe, this.baseAzimuthPara) * k
      // refit por frame: a distância sai do fov e do aspecto, e as
      // meia-extensões estão mudando o tempo todo durante o voo.
      this.refit()
      if (this.flight.t >= 1) this.flight = null
    }

    const reduced = this.quality.reducedMotion
    const scale = reduced ? REDUCED_SCALE : 1

    this.gain = damp(this.gain, this.pointer.isDown ? DRAG_GAIN : 1, 4, dt)

    const targetAzimuth = -this.pointer.smooth.x * AZIMUTH_RANGE * this.gain * scale
    const targetPolar = this.pointer.smooth.y * POLAR_RANGE * this.gain * scale

    this.azimuth = damp(this.azimuth, targetAzimuth, 3.2, dt)
    this.polar = damp(this.polar, targetPolar, 3.2, dt)

    // Two incommensurable frequencies never repeat their pattern, so the idle
    // motion does not read as a loop.
    this.drift = reduced ? 0 : 1
    const driftAz = Math.sin(elapsed * 0.11) * DRIFT_AZIMUTH * this.drift
    const driftPo = Math.sin(elapsed * 0.077 + 1.3) * DRIFT_POLAR * this.drift

    const az = this.baseAzimuth + this.azimuth + driftAz
    const po = this.polar + driftPo

    // Movimento reduzido tira o dolly inteiro: é deslocamento de câmera de
    // corpo inteiro, que é exatamente a classe de movimento que incomoda.
    this.scrollTarget = reduced ? 0 : this.scrollTarget
    this.scroll = damp(this.scroll, this.scrollTarget, 2.6, dt)
    const { ganhoRaio, subida } = scrollDolly(this.scroll)
    const raio = this.radius * ganhoRaio

    const cosPo = Math.cos(po)
    const fx = this.focus.x + this.shiftX
    const fy = this.focus.y + this.shiftY + subida
    this.camera.position.set(
      fx + Math.sin(az) * cosPo * raio,
      fy + Math.sin(po) * raio + 1.2,
      this.focus.z + Math.cos(az) * cosPo * raio,
    )
    this.camera.lookAt(fx, fy, this.focus.z)
  }
}
