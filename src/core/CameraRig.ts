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
/**
 * Piso de segurança pra `radius`, não uma distância "normal" — só existe pra
 * impedir a câmera de acabar dentro da própria geometria se algum
 * enquadramento vier com meia-extensão perto de zero.
 *
 * `flyAlongBranch` tem seu próprio piso (`meia = max(..., 1.4)`), e o pior
 * caso disso — vFov de 46°, altura mandando na distância — ainda pede ~3.5
 * de raio (`1.4 * FIT_MARGIN / tan(23°)`). Este valor fica abaixo disso de
 * propósito: se ficasse por cima, quem decidiria a distância de todo galho
 * curto seria este piso, não as contas de `refit()` — e foi exatamente isso
 * que aconteceu com o valor antigo (12, ajustado só pra copa da árvore
 * inteira). A copa nunca chega perto de 3, então baixar o piso não move o
 * enquadramento dela nem o do blog.
 */
export const MIN_RADIUS = 3
export const MAX_RADIUS = 60

/**
 * Empurrão extra que `flyAlongBranch` pede em `refit()`, em fração do
 * alcance horizontal da lente na distância de enquadramento — não da
 * meia-largura do assunto. Ver o comentário de `refit()` pro porquê disso
 * ser um número diferente do `0.42` de `shiftX`.
 *
 * 0.3 mede pra uma coluna de leitura de `--measure` (34rem) centrada: numa
 * janela de referência de 1470px a borda dela fica a ~0.37 da metade da
 * tela, e este termo contribui 0.3 sozinho, mais o `halfWidth * 0.42`
 * herdado — o suficiente pra passar da borda com folga sem empurrar a rua
 * pra fora do outro lado da lente.
 */
const GALHO_FOLGA = 0.3

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

/**
 * Distância de enquadramento pra caber as duas meia-extensões no fov da
 * câmera, já com o piso/teto de `MIN_RADIUS`/`MAX_RADIUS` aplicado.
 *
 * Pura e testada à parte do resto de `refit()` porque é exatamente a conta
 * que o `MIN_RADIUS` antigo (12, tunado só pra árvore inteira) atropelava
 * pra qualquer assunto menor — um teste aqui prende o raio de um galho no
 * lugar certo sem precisar montar uma `CameraRig` inteira, com câmera e
 * ponteiro de verdade.
 */
export function fitRadius(
  halfWidth: number,
  halfHeight: number,
  fovDeg: number,
  aspect: number,
): number {
  const vFov = (fovDeg * Math.PI) / 180
  const hHalfAngle = Math.atan(Math.tan(vFov / 2) * aspect)
  // Distance at which each axis exactly fills its half-angle; take whichever
  // is further so both fit.
  const distance = Math.max(
    (halfHeight * FIT_MARGIN) / Math.tan(vFov / 2),
    (halfWidth * FIT_MARGIN) / Math.tan(hHalfAngle),
  )
  return Math.min(Math.max(distance, MIN_RADIUS), MAX_RADIUS)
}

export interface EmpurraoLateral {
  shiftX: number
  shiftZ: number
}

/**
 * Empurrão lateral do ponto de mira, já girado pro X/Z do mundo no azimute
 * de repouso.
 *
 * `-halfWidth * 0.42` é o termo herdado da árvore — mas é um deslocamento
 * cru em X do *mundo*, e X do mundo só coincide com "direita da tela" quando
 * o azimute de repouso é 0. É 0 pra sempre na árvore, na copa e no 404
 * (`flyTo` nunca pede outro), então o termo sempre funcionou pra eles. Um
 * galho não: `flyAlongBranch` pousa em qualquer azimute ao redor do tronco,
 * e nesse caso um empurrão em X cru pode acabar quase todo na profundidade
 * em vez de na largura da tela — foi o que mediu ~9px de deslocamento real
 * numa tela de 1470px, praticamente nada.
 *
 * `folga` resolve isso em dois passos. Primeiro, o alvo: em vez de uma
 * fração da meia-largura do *assunto* (que pra um galho é metade do próprio
 * comprimento dele, sem relação nenhuma com a largura da coluna de leitura
 * por cima), soma-se uma fração do alcance horizontal da *lente* na
 * distância de enquadramento (`radius * tanH`). Como o deslocamento em tela
 * que esse termo produz simplifica pra `folga` sozinho (os dois `radius *
 * tanH` se cancelam), a mesma fração de tela nasce de qualquer raio — vale
 * igual pro galho mais curto e pro mais comprido. Segundo, a direção: os
 * dois termos somam em "direita da tela no azimute de repouso" e só então
 * giram pro X/Z do mundo — a mesma trigonometria que já posiciona a câmera
 * em `update()`, aplicada ao ponto de mira em vez de à órbita. Em
 * `baseAzimuth = 0` o giro não faz nada (cos 0 = 1, sin 0 = 0): o termo
 * herdado vira `shiftX` puro, `shiftZ` fica 0, e a árvore/copa/404 saem bit
 * a bit como antes desta função existir.
 */
export function lateralShift(
  halfWidth: number,
  radius: number,
  fovDeg: number,
  aspect: number,
  baseAzimuth: number,
  folga: number,
  wide: boolean,
): EmpurraoLateral {
  const vFov = (fovDeg * Math.PI) / 180
  const hHalfAngle = Math.atan(Math.tan(vFov / 2) * aspect)
  const alcanceHorizontal = radius * Math.tan(hHalfAngle)
  const lateral = wide ? -halfWidth * 0.42 - folga * alcanceHorizontal : 0
  return {
    shiftX: lateral * Math.cos(baseAzimuth),
    shiftZ: -lateral * Math.sin(baseAzimuth),
  }
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
  /**
   * Componente em Z do mesmo empurrão lateral — ver `refit()`. Sempre 0 fora
   * de um voo a galho: aí o azimute de repouso é 0 e o empurrão cabe inteiro
   * em `shiftX`, exatamente como antes desta peça existir.
   */
  private shiftZ = 0

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

  /**
   * Fração do alcance horizontal da lente pedida como empurrão extra pra
   * tirar o assunto de trás da coluna de leitura — ver `refit()` e
   * `GALHO_FOLGA`. Interpola junto com o resto do voo, do mesmo jeito que
   * `baseAzimuth` faz duas linhas abaixo.
   */
  private folga = 0
  private folgaDe = 0
  private folgaPara = 0
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

  /**
   * Recompute the orbit distance. Call whenever the projection changes.
   *
   * The maths live in `fitRadius`/`lateralShift` — pure functions above,
   * tested on their own — so this method is just wiring: read the camera and
   * the current framing, write the fields `update()` consumes.
   */
  refit(): void {
    const wide = this.camera.aspect > 1.15
    this.shiftY = wide ? 0 : this.halfHeight * 0.28

    this.radius = fitRadius(this.halfWidth, this.halfHeight, this.camera.fov, this.camera.aspect)

    const { shiftX, shiftZ } = lateralShift(
      this.halfWidth,
      this.radius,
      this.camera.fov,
      this.camera.aspect,
      this.baseAzimuth,
      this.folga,
      wide,
    )
    this.shiftX = shiftX
    this.shiftZ = shiftZ
  }

  /** Enquadramento atual, copiado — quem recebe pode guardar sem alias. */
  private get enquadramento(): Enquadramento {
    return {
      focus: this.focus.clone(),
      halfWidth: this.halfWidth,
      halfHeight: this.halfHeight,
    }
  }

  private partir(para: Enquadramento, azimute: number, seconds: number, folga = 0): void {
    const dur = this.quality.reducedMotion ? 0 : seconds

    this.baseAzimuthDe = this.baseAzimuth
    this.baseAzimuthPara = azimute
    this.folgaDe = this.folga
    this.folgaPara = folga

    if (dur <= 0) {
      // Movimento reduzido não ganha uma versão lenta do voo: ganha o destino.
      this.focus.copy(para.focus)
      this.halfWidth = para.halfWidth
      this.halfHeight = para.halfHeight
      this.baseAzimuth = azimute
      this.folga = folga
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
   * O ponto de mira é o meio do galho, mas a meia-extensão enquadrada não é a
   * do galho em si — é a do mundo em miniatura que cresce na ponta dele (uma
   * ruazinha de ~4×0.55×3.16 unidades). Enquadrar só o galho (0.62×
   * comprimento) deixa a câmera perto demais pra caber essa rua: ela projeta
   * larga demais na tela e o lado longe sai cortado da borda. `1.38`/`3.1`
   * (o mesmo `0.62`/`1.4` escalados por ~2.22) empurram a distância de
   * enquadramento de ~5 pra ~11 unidades — perto o bastante pra ler como
   * cidadezinha, longe o bastante pra caber inteira. O azimute de repouso
   * fica perpendicular à direção do galho — olhar na direção do eixo dele
   * enquadraria um ponto. `GALHO_FOLGA` é o pedido de empurrão extra que
   * `refit()` usa pra tirar o mundo do post de trás da coluna de leitura —
   * ver o comentário lá pro porquê de não bastar reusar o `0.42` da árvore.
   */
  flyAlongBranch(branch: BranchRecord, seconds: number): void {
    const meio = branch.start.clone().add(branch.tip).multiplyScalar(0.5)
    const meia = Math.max(branch.length * 1.38, 3.1)
    const azimute = Math.atan2(branch.along.x, branch.along.z) + Math.PI / 2
    this.partir({ focus: meio, halfWidth: meia, halfHeight: meia }, azimute, seconds, GALHO_FOLGA)
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
      this.folga = this.folgaDe + (this.folgaPara - this.folgaDe) * k
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
    const fz = this.focus.z + this.shiftZ
    this.camera.position.set(
      fx + Math.sin(az) * cosPo * raio,
      fy + Math.sin(po) * raio + 1.2,
      fz + Math.cos(az) * cosPo * raio,
    )
    this.camera.lookAt(fx, fy, fz)
  }
}
