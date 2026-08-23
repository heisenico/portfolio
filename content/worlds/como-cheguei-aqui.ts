/**
 * "a rua" — o mundo do post `como-cheguei-aqui`.
 *
 * Homenagem, não reprodução: cada vértice deste arquivo foi escrito aqui.
 * Duas casas, uma cerca, um ônibus e figuras paradas num quintal são objetos
 * de subúrbio genéricos, e é só isso que eles são.
 *
 * A rua inteira cabe em três unidades de mundo, que é mais ou menos o que
 * `flyAlongBranch` enquadra: ela cresce na ponta do galho sem nunca tapar a
 * árvore. Uma vila de maquete num galhinho é a tese do site dita em voz alta.
 *
 * Nada aqui tem relógio próprio. Toda batida é função de `progress`, e parar
 * de rolar congela a rua no meio da construção — que é exatamente o que deve
 * acontecer. As duas únicas coisas que andam sozinhas (a ondulação do shader e
 * o giro da sirene) param sob `prefers-reduced-motion`.
 *
 * O arquivo é encontrado pelo slug do post. Renomear o post sem renomear este
 * arquivo derruba o post no mundo genérico — `orphanWorlds` avisa em dev.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Frustum,
  Group,
  LineSegments,
  Matrix4,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { branchFragment, branchVertex } from '../../src/fx/shaders/branch'
import { easeOutCubic, lerp } from '../../src/util/tween'
import { beat, type PostWorldContext, type PostWorldModule } from '../../src/world/PostWorld'

/* ------------------------------------------------------------------ cores */

/*
 * Espelho exato de `src/styles/tokens.css`. Nenhuma cor nova entra na cena.
 */
/** `--green` */
const VERDE = 0x4fe08f
/** `--green-hot` */
const VERDE_QUENTE = 0xd9ffe9
/** `--amber` */
const AMBAR = 0xffc27a

/*
 * Constantes de leitura, nunca mutadas: quem deriva de tom copia delas pra uma
 * cor da instância. O módulo é reaproveitado entre visitas, então mutar uma
 * destas vazaria estado de uma leitura pra próxima.
 */
const COR_VERDE = new Color(VERDE)
const COR_VERDE_QUENTE = new Color(VERDE_QUENTE)
const COR_AMBAR = new Color(AMBAR)
/**
 * O âmbar não tem par "quente" em tokens.css. Em vez de inventar um hex, ele é
 * o próprio âmbar clareado na direção do `--green-hot` — que é justamente a
 * relação entre `--green` e `--green-hot`.
 */
const COR_AMBAR_QUENTE = new Color(AMBAR).lerp(COR_VERDE_QUENTE, 0.5)

/* ------------------------------------------------------------------ escala */

/** A rua inteira, ponta a ponta, ao longo do galho. */
const RUA_COMPRIMENTO = 3.2
/** Largura do calçamento. As guias ficam dentro dela, ver `CERCA_X`. */
const RUA_LARGURA = 0.9
/** Quantas transversais o piso tem. As longitudinais saem daí. */
const CHAO_DIVISOES = 16
const CHAO_FAIXAS = 4
/** A faixa central mora um fio acima do piso, e por isso soma em vez de sumir. */
const CHAO_TRACO_Y = 0.004

const CASA_ALTURA = 0.55
const CASA_PAREDE = 0.38
const CASA_TELHADO = CASA_ALTURA - CASA_PAREDE
const CASA_LARGURA = 0.62
/** Rasa de propósito: a fachada tem que parar na borda do calçamento. */
const CASA_PROFUNDIDADE = 0.36

const CERCA_COMPRIMENTO = 2.8
const CERCA_RIPAS = 24
const CERCA_ALTURA = 0.11
const CERCA_PONTA = 0.035
const CERCA_X = 0.3

const ONIBUS_COMPRIMENTO = 0.7
const ONIBUS_LARGURA = 0.26
const ONIBUS_CORPO = 0.24
const ONIBUS_RODA = 0.045
const ONIBUS_X = 0.34
/** Onde ele para. */
const ONIBUS_Z = -1.05
/** De onde ele vem — de fora do enquadramento, rua acima. */
const ONIBUS_Z_PARTIDA = -2.6

const FIGURA_ALTURA = 0.22
const FIGURA_PERNA = 0.09
const FIGURA_OMBRO = 0.17
const FIGURA_BRACO_Y = 0.105
const FIGURA_BRACO_X = 0.045
const CABECA_RAIO = 0.025
const CABECA_Y = FIGURA_ALTURA - CABECA_RAIO
const CABECA_LADOS = 6
/** Passando disto o quintal deixa de ser inquietante e vira multidão. */
const MAX_FIGURAS = 8

const POSTE_Z = 1.4
const POSTE_ALTURA = 0.34
const LEQUE_RAIO = 0.1
const LEQUE_RAIOS = 8
/** Radianos por segundo do varrimento da sirene. */
const SIRENE_GIRO = 2.2

/* ----------------------------------------------------------------- shader */

/*
 * Mesma sintonia do `ScanReveal` da árvore: a rua tem que ler como o mesmo
 * material, não como uma camada nova por cima.
 */
const REPOUSO = 0.46
const GANHO = 1.35
const GANHO_QUENTE = 3.1
const PROFUNDIDADE_MAX = 6
/**
 * Largura da frente acesa, em fração do alcance da peça.
 *
 * O `ScanReveal` usa 2.6 unidades fixas porque a árvore inteira se revela com
 * um raio só. Aqui cada peça tem o seu, e uma banda fixa que lê bem numa rua
 * de 3.2 cobriria uma ripa de cerca inteira de uma vez.
 */
const BANDA_FRACAO = 0.22
const BANDA_MINIMA = 0.1

/* --------------------------------------------------------------- timeline */

/**
 * Quando cada coisa se monta, em fração do texto lido.
 *
 * Nada aqui tem relógio próprio — contrato item 5. Parar de rolar congela a
 * rua no meio da construção, que é exatamente o que deve acontecer.
 */
const JANELAS = {
  chao: [0.0, 0.12],
  casaA: [0.1, 0.3],
  casaB: [0.18, 0.38],
  cerca: [0.32, 0.48],
  onibus: [0.42, 0.58],
  /** O ônibus chega depois de existir. Montar e entrar são coisas diferentes. */
  chegada: [0.48, 0.64],
  figuras: [0.52, 0.84],
  sirene: [0.8, 0.94],
  /**
   * Volta pro verde antes do fim — contrato item 3.
   *
   * Termina em 0.97 e não em 0.99 porque o contrato diz "verde de novo a
   * partir de 0.97", que é o mesmo `HUE_VERDE_DESDE` que o mundo gerado
   * respeita em `PostWorld.ts`. Acabar em 0.99 deixaria a rua um terço âmbar
   * no ponto em que ela já devia ter voltado.
   */
  regresso: [0.94, 0.97],
  clarao: [0.955, 1.0],
} as const

/** Quanto de progresso cada figura leva pra se montar. */
const FIGURA_MONTAGEM = 0.05
/** Onde o clarão vira: sobe até aqui e cai daqui até o fim. */
const CLARAO_PICO = 0.975
/** Teto do clarão sob movimento reduzido — contrato item 6. */
const CLARAO_REDUZIDO = 0.15
/**
 * Teto do clarão sem movimento reduzido.
 *
 * Contra uma página quase preta, ~0.6 ainda lê como clarão inconfundível —
 * não precisa de 1.0 (tela cheia) pra bater o efeito. `prefers-reduced-motion`
 * é sinal de movimento, não de fotossensibilidade: um leitor sem essa
 * preferência marcada não abriu mão de proteção contra flash, então o teto
 * aqui existe pra ninguém receber uma tela de opacidade 1.0 de surpresa.
 */
const CLARAO_PICO_TETO = 0.6
/**
 * Subida máxima de opacidade do clarão por segundo — WCAG 2.3.1.
 *
 * O clarão é guiado por `progress`, isto é, por rolagem. Sem isso, arrastar a
 * scrollbar rápido pela janela `clarao` sobe a opacidade mais rápido que três
 * vezes por segundo, que é o limite da regra. 1/0.3 mantém a subida mais lenta
 * que isso não importa quão rápido `progress` ande; a descida (contrato:
 * "sobe até 0.975 e some") continua livre — escurecer rápido não pisca.
 */
const CLARAO_SUBIDA_POR_SEGUNDO = 1 / 0.3
/** A rua some junto com o clarão. */
const SUMICO_DE = 0.972
const SUMICO_ATE = 1.0
/** Quanto a paleta chega a derivar no auge da sirene. */
const DERIVA_QUENTE = 0.85

/** Quanto tempo uma figura aguenta ficar visível devendo um giro. */
const ESPERA_MAXIMA = 2
/** Duração do giro quando ele não teve como acontecer escondido. */
const GIRO_SEGUNDOS = 0.18

/**
 * Os lugares do quintal, fixos.
 *
 * Um estranho parado sempre no mesmo lugar toda vez que você visita é muito
 * pior — e muito melhor — do que um parado num lugar novo.
 *
 * `giro` é a direção do corpo, que nunca muda: quem vira é só a cabeça. Todos
 * olham mais ou menos rua acima ou rua abaixo, nunca para os lados, porque
 * `flyAlongBranch` enquadra o galho de través: de perfil, a cabeça é um risco
 * de nada, e virada pra câmera é um anel inteiro. É essa diferença que faz
 * dar pra notar sem nunca dar pra flagrar.
 */
const QUINTAL = [
  { x: -0.55, z: 0.35, giro: Math.PI * -0.18 },
  { x: 0.58, z: -0.35, giro: Math.PI * 0.86 },
  { x: -0.72, z: 0.95, giro: Math.PI * 1.12 },
  { x: 0.5, z: 1.15, giro: Math.PI * -0.08 },
  { x: -0.5, z: -1.15, giro: Math.PI * 0.22 },
  { x: 0.68, z: -1.35, giro: Math.PI * 0.94 },
  { x: -0.85, z: -0.05, giro: Math.PI * 1.05 },
  { x: 0.8, z: 1.45, giro: Math.PI * 0.1 },
] as const

/* -------------------------------------------------------------- geometria */

/** Pares de vértices, 6 floats por segmento. */
type Pontos = number[]

function segmento(
  p: Pontos,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): void {
  p.push(ax, ay, az, bx, by, bz)
}

/** Retângulo no plano XY, num z fixo — porta e janela. */
function retangulo(p: Pontos, x0: number, y0: number, x1: number, y1: number, z: number): void {
  segmento(p, x0, y0, z, x1, y0, z)
  segmento(p, x1, y0, z, x1, y1, z)
  segmento(p, x1, y1, z, x0, y1, z)
  segmento(p, x0, y1, z, x0, y0, z)
}

/** Cópia deslocada de um bloco de pontos já pronto. */
function deslocar(p: Pontos, dx: number, dy: number, dz: number): Pontos {
  const saida: Pontos = []
  for (let i = 0; i + 2 < p.length; i += 3) {
    saida.push(p[i]! + dx, p[i + 1]! + dy, p[i + 2]! + dz)
  }
  return saida
}

/** Anel de `lados` lados no plano XY, centrado na origem. Roda e cabeça. */
function anel(raio: number, lados: number): Pontos {
  const p: Pontos = []
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2
    const b = ((i + 1) / lados) * Math.PI * 2
    segmento(
      p,
      Math.cos(a) * raio,
      Math.sin(a) * raio,
      0,
      Math.cos(b) * raio,
      Math.sin(b) * raio,
      0,
    )
  }
  return p
}

/** As 12 arestas de uma caixa apoiada na própria base. */
function caixa(l: number, a: number, p: number): Pontos {
  const x = l / 2
  const z = p / 2
  const pts: Pontos = []
  for (const y of [0, a]) {
    segmento(pts, -x, y, -z, x, y, -z)
    segmento(pts, x, y, -z, x, y, z)
    segmento(pts, x, y, z, -x, y, z)
    segmento(pts, -x, y, z, -x, y, -z)
  }
  for (const sx of [-x, x]) {
    for (const sz of [-z, z]) segmento(pts, sx, 0, sz, sx, a, sz)
  }
  return pts
}

/**
 * Caixa mais duas águas que se encontram numa cumeeira, e as duas empenas.
 *
 * A empena não precisa de segmento próprio: os dois caibros daquele lado mais
 * a aresta de cima da parede já fecham o triângulo. Porta e janelas ficam na
 * fachada (+Z local), porque casa sem vão nenhum lê como engradado.
 */
function casa(l: number, a: number, p: number, telhado: number): Pontos {
  const pts = caixa(l, a, p)
  const x = l / 2
  const z = p / 2
  const topo = a + telhado

  segmento(pts, 0, topo, -z, 0, topo, z)
  for (const sz of [-z, z]) {
    segmento(pts, -x, a, sz, 0, topo, sz)
    segmento(pts, x, a, sz, 0, topo, sz)
  }

  retangulo(pts, -l * 0.1, 0, l * 0.1, a * 0.62, z)
  retangulo(pts, -l * 0.4, a * 0.38, -l * 0.2, a * 0.66, z)
  retangulo(pts, l * 0.2, a * 0.38, l * 0.4, a * 0.66, z)

  return pts
}

/**
 * Duas travessas e `ripas` ripas, cada uma com a pontinha em bico.
 *
 * Tudo no plano YZ: a cerca corre ao longo da rua, então o bico tem que
 * apontar dentro do próprio plano dela pra ler como bico e não como galho.
 */
function cerca(comprimento: number, ripas: number): Pontos {
  const pts: Pontos = []
  const meio = comprimento / 2
  const passo = comprimento / ripas
  // As travessas vão em pedaços de um vão cada, e não de ponta a ponta: ver
  // `chao`, é a mesma razão.
  for (const y of [CERCA_ALTURA * 0.36, CERCA_ALTURA * 0.82]) {
    for (let i = 0; i < ripas; i++) {
      const z0 = -meio + i * passo
      segmento(pts, 0, y, z0, 0, y, z0 + passo)
    }
  }
  const meiaPonta = passo * 0.3
  for (let i = 0; i < ripas; i++) {
    const z = -meio + (i + 0.5) * passo
    segmento(pts, 0, 0, z, 0, CERCA_ALTURA, z)
    segmento(pts, 0, CERCA_ALTURA, z - meiaPonta, 0, CERCA_ALTURA + CERCA_PONTA, z)
    segmento(pts, 0, CERCA_ALTURA + CERCA_PONTA, z, 0, CERCA_ALTURA, z + meiaPonta)
  }
  return pts
}

/**
 * Corpo, cabine recuada em cima e quatro rodas.
 *
 * Construído deitado no eixo X, com as rodas no plano XY — é assim que roda e
 * eixo ficam certos. Quem alinha ele com a rua é o `rotation.y` da peça.
 */
function onibus(comprimento: number): Pontos {
  const pts = deslocar(caixa(comprimento, ONIBUS_CORPO, ONIBUS_LARGURA), 0, ONIBUS_RODA, 0)
  pts.push(
    ...deslocar(
      caixa(comprimento * 0.34, 0.07, ONIBUS_LARGURA * 0.78),
      comprimento * 0.2,
      ONIBUS_RODA + ONIBUS_CORPO,
      0,
    ),
  )
  for (const dx of [-comprimento * 0.3, comprimento * 0.3]) {
    for (const dz of [-ONIBUS_LARGURA / 2, ONIBUS_LARGURA / 2]) {
      pts.push(...deslocar(anel(ONIBUS_RODA, 8), dx, ONIBUS_RODA, dz))
    }
  }
  return pts
}

/** Duas pernas, um tronco, dois braços. A cabeça é peça à parte, pra girar. */
function figura(): Pontos {
  const pts: Pontos = []
  segmento(pts, -0.03, 0, 0, 0, FIGURA_PERNA, 0)
  segmento(pts, 0.03, 0, 0, 0, FIGURA_PERNA, 0)
  segmento(pts, 0, FIGURA_PERNA, 0, 0, FIGURA_OMBRO, 0)
  segmento(pts, 0, FIGURA_OMBRO - 0.015, 0, -FIGURA_BRACO_X, FIGURA_BRACO_Y, 0)
  segmento(pts, 0, FIGURA_OMBRO - 0.015, 0, FIGURA_BRACO_X, FIGURA_BRACO_Y, 0)
  return pts
}

/** O piso, mais a faixa central tracejada correndo o comprimento da rua. */
function chao(comprimento: number, largura: number, divisoes: number): Pontos {
  const pts: Pontos = []
  const meioC = comprimento / 2
  const meioL = largura / 2

  const passoZ = comprimento / divisoes
  const passoX = largura / CHAO_FAIXAS

  // Arestas de célula, e não linhas de ponta a ponta: `aDist` é por vértice, e
  // uma linha inteira tem as duas pontas à mesma distância da origem — ela
  // acenderia de uma vez só, e o piso apareceria em vez de ser varrido.
  for (let i = 0; i <= divisoes; i++) {
    const z = -meioC + i * passoZ
    for (let j = 0; j < CHAO_FAIXAS; j++) {
      const x = -meioL + j * passoX
      segmento(pts, x, 0, z, x + passoX, 0, z)
    }
  }
  for (let j = 0; j <= CHAO_FAIXAS; j++) {
    const x = -meioL + j * passoX
    for (let i = 0; i < divisoes; i++) {
      const z = -meioC + i * passoZ
      segmento(pts, x, 0, z, x, 0, z + passoZ)
    }
  }

  // O traço cai em cima da longitudinal do meio, e com blending aditivo duas
  // linhas no mesmo lugar são uma linha mais clara — que é o que se quer.
  for (let i = 0; i < divisoes; i++) {
    const z0 = -meioC + (i + 0.2) * passoZ
    segmento(pts, 0, CHAO_TRACO_Y, z0, 0, CHAO_TRACO_Y, z0 + passoZ * 0.6)
  }

  return pts
}

/** Raios saindo de um cubo, no plano XZ: girando em Y, isso varre. */
function leque(raio: number, raios: number): Pontos {
  const pts: Pontos = []
  for (let i = 0; i < raios; i++) {
    const a = (i / raios) * Math.PI * 2
    segmento(pts, 0, 0, 0, Math.cos(a) * raio, 0, Math.sin(a) * raio)
  }
  return pts
}

/* ------------------------------------------------------------------ peças */

/** Um objeto do cenário, com a própria janela de montagem. */
interface Peca {
  linhas: LineSegments
  material: ShaderMaterial
  geometria: BufferGeometry
  /** Trecho do progresso em que ela se monta. */
  de: number
  ate: number
  /** Vértice mais distante da origem local. */
  alcance: number
  /** Largura da frente acesa desta peça. Ver `uScanRadius` em `update`. */
  banda: number
}

/**
 * @param pontos pares de vértices, 6 floats por segmento, em coordenadas
 *        locais da peça.
 * @param origem de onde a frente de onda parte, em coordenadas da peça. Cada
 *        peça tem a própria: a casa se monta a partir da base dela, e não a
 *        partir do meio da rua, porque é assim que uma coisa parece ser
 *        construída em vez de aparecer fatiada.
 */
function fazerPeca(
  pontos: Pontos,
  origem: Vector3,
  profundidade: number,
  de: number,
  ate: number,
): Peca {
  const total = pontos.length / 3
  const posicoes = new Float32Array(pontos)
  const distancias = new Float32Array(total)
  const profundidades = new Float32Array(total)
  const galhos = new Float32Array(total)

  let alcance = 0
  for (let i = 0; i < total; i++) {
    const dx = posicoes[i * 3]! - origem.x
    const dy = posicoes[i * 3 + 1]! - origem.y
    const dz = posicoes[i * 3 + 2]! - origem.z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    distancias[i] = d
    profundidades[i] = profundidade
    // -1: o destaque de galho único da árvore nunca dispara aqui.
    galhos[i] = -1
    if (d > alcance) alcance = d
  }

  const banda = Math.max(BANDA_MINIMA, alcance * BANDA_FRACAO)

  const geometria = new BufferGeometry()
  geometria.setAttribute('position', new BufferAttribute(posicoes, 3))
  geometria.setAttribute('aDist', new BufferAttribute(distancias, 1))
  geometria.setAttribute('aDepth', new BufferAttribute(profundidades, 1))
  geometria.setAttribute('aBranchId', new BufferAttribute(galhos, 1))

  const material = new ShaderMaterial({
    vertexShader: branchVertex,
    fragmentShader: branchFragment,
    // Os mesmos nomes de uniforme do `ScanReveal`, e a mesma fusão com
    // `UniformsLib.fog`: o par de sombreadores inclui os chunks de neblina do
    // three.js, e um `fogColor` faltando é aviso de WebGL no load.
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uScanRadius: { value: 0 },
        uBand: { value: banda },
        uRest: { value: REPOUSO },
        uMaxDepth: { value: PROFUNDIDADE_MAX },
        uTime: { value: 0 },
        uRestColor: { value: new Color(VERDE) },
        uEdgeColor: { value: new Color(VERDE_QUENTE) },
        uOpacity: { value: 1 },
        uGain: { value: GANHO },
        uHotGain: { value: GANHO_QUENTE },
        uLitBranch: { value: -1 },
        // O mesmo par de sombreadores de `branch.ts` agora lê vento — mas as
        // peças da rua penduram num Group ancorado na ponta do galho, em
        // coordenadas locais. Um vento compartilhado com a copa rasgaria a
        // rua fora do lugar; zero aqui é correção, não preguiça.
        uWind: { value: new Vector2() },
        uWindTime: { value: 0 },
      },
    ]),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: true,
  })

  const linhas = new LineSegments(geometria, material)
  linhas.frustumCulled = false

  return { linhas, material, geometria, de, ate, alcance, banda }
}

/* ---------------------------------------------------------------- figuras */

/**
 * Elas nunca viram enquanto você está olhando.
 *
 * A cabeça só gira quando a figura está fora do frustum, então o giro é
 * impossível de flagrar — você só percebe que aconteceu. Se ela ficar visível
 * por mais de dois segundos depois de já dever ter virado, ela vira mesmo
 * assim, em 180ms: um segredo que nunca se cumpre vira um bug.
 */
interface Figura {
  grupo: Group
  cabeca: LineSegments
  /** Progresso a partir do qual ela já devia estar olhando. */
  virarEm: number
  deveOlhar: boolean
  virou: boolean
  esperando: number
  girando: boolean
  giroDe: number
  /** Quanto ainda falta girar, já pelo menor caminho. */
  giroDelta: number
  giroT: number
  /** Centro da cabeça em coordenadas de mundo. Fixo: figura não anda. */
  mundo: Vector3
}

/**
 * Tudo que uma montagem cria, num campo só.
 *
 * `loadPostWorld` devolve o default do módulo e o glob guarda o módulo, então
 * este objeto é o mesmo entre visitas. Estado que sobreviva a um `dispose()`
 * vaza pra próxima leitura — juntar tudo num campo faz "devolver ao zero" ser
 * uma atribuição só, e faz o contrato item 7 ser conferível de bater o olho.
 */
interface Montagem {
  raiz: Group
  pecas: Peca[]
  figuras: Figura[]
  onibus: Peca
  leque: Peca
  clarao: HTMLDivElement
  /** Último valor escrito no clarão, pra não sujar o DOM parado. */
  claraoOpacidade: string
  frustum: Frustum
  matriz: Matrix4
  corRepouso: Color
  corBorda: Color
  aux: Vector3
}

const ORIGEM = new Vector3(0, 0, 0)
const UP = new Vector3(0, 1, 0)

class Rua implements PostWorldModule {
  private ctx: PostWorldContext | null = null
  private montagem: Montagem | null = null

  build(ctx: PostWorldContext): void {
    // Defensivo: hoje `dispose()` sempre roda antes do próximo `build()`
    // (`PostWorld.ts` troca de mundo assim), mas esta instância é reusada
    // entre visitas — ver o comentário acima de `Montagem`. Sem isso, um
    // `build()` chamado sem `dispose()` antes orfanaria a raiz e as peças
    // da montagem anterior na cena, e esse é o padrão que todo mundo
    // sob medida futuro copia deste arquivo.
    if (this.montagem) this.dispose()

    const frente = new Vector3(ctx.branch.along.x, 0, ctx.branch.along.z)
    // Um galho perfeitamente vertical não tem direção horizontal; nesse caso
    // qualquer direção serve, e o que não serve é NaN.
    if (frente.lengthSq() < 1e-6) frente.set(0, 0, 1)
    frente.normalize()
    const lado = new Vector3().crossVectors(UP, frente).normalize()

    const raiz = new Group()
    raiz.position.copy(ctx.branch.tip)
    raiz.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(lado, UP, frente))

    const pecas: Peca[] = []

    const piso = fazerPeca(
      chao(RUA_COMPRIMENTO, RUA_LARGURA, CHAO_DIVISOES),
      ORIGEM,
      5,
      ...JANELAS.chao,
    )
    pecas.push(piso)

    // As duas casas se encaram, mas deslocadas também em Z: rua perfeitamente
    // simétrica lê como diagrama.
    const casaA = fazerPeca(
      casa(CASA_LARGURA, CASA_PAREDE, CASA_PROFUNDIDADE, CASA_TELHADO),
      ORIGEM,
      2,
      ...JANELAS.casaA,
    )
    casaA.linhas.position.set(-0.62, 0, -0.5)
    casaA.linhas.rotation.y = Math.PI / 2
    pecas.push(casaA)

    const casaB = fazerPeca(
      casa(CASA_LARGURA, CASA_PAREDE, CASA_PROFUNDIDADE, CASA_TELHADO),
      ORIGEM,
      2,
      ...JANELAS.casaB,
    )
    casaB.linhas.position.set(0.62, 0, 0.55)
    casaB.linhas.rotation.y = -Math.PI / 2
    pecas.push(casaB)

    for (const x of [-CERCA_X, CERCA_X]) {
      const linha = fazerPeca(cerca(CERCA_COMPRIMENTO, CERCA_RIPAS), ORIGEM, 4, ...JANELAS.cerca)
      linha.linhas.position.set(x, 0, 0)
      pecas.push(linha)
    }

    const buzu = fazerPeca(onibus(ONIBUS_COMPRIMENTO), ORIGEM, 2, ...JANELAS.onibus)
    // Deitado no eixo X e virado pra +Z: ele sobe a rua no sentido em que anda.
    buzu.linhas.rotation.y = -Math.PI / 2
    buzu.linhas.position.set(ONIBUS_X, 0, ONIBUS_Z_PARTIDA)
    pecas.push(buzu)

    const figuras: Figura[] = []
    const total = Math.min(ctx.post.paragrafos, MAX_FIGURAS)
    const [figDe, figAte] = JANELAS.figuras
    for (const [i, ponto] of QUINTAL.slice(0, total).entries()) {
      const de = figDe + (i / total) * (figAte - figDe)
      const ate = de + FIGURA_MONTAGEM

      const grupo = new Group()
      grupo.position.set(ponto.x, 0, ponto.z)
      grupo.rotation.y = ponto.giro

      const corpo = fazerPeca(figura(), ORIGEM, 3, de, ate)
      // A cabeça é peça própria pra poder girar, mas a distância de montagem
      // dela é medida dos pés: assim ela sobe junto com o corpo em vez de
      // aparecer flutuando antes dele.
      const cabeca = fazerPeca(
        anel(CABECA_RAIO, CABECA_LADOS),
        new Vector3(0, -CABECA_Y, 0),
        3,
        de,
        ate,
      )
      cabeca.linhas.position.y = CABECA_Y

      grupo.add(corpo.linhas, cabeca.linhas)
      raiz.add(grupo)
      pecas.push(corpo, cabeca)

      figuras.push({
        grupo,
        cabeca: cabeca.linhas,
        virarEm: ate,
        deveOlhar: false,
        virou: true,
        esperando: 0,
        girando: false,
        giroDe: 0,
        giroDelta: 0,
        giroT: 0,
        mundo: new Vector3(),
      })
    }

    const poste = fazerPeca([0, 0, 0, 0, POSTE_ALTURA, 0], ORIGEM, 4, ...JANELAS.sirene)
    poste.linhas.position.set(0, 0, POSTE_Z)
    pecas.push(poste)

    const abano = fazerPeca(leque(LEQUE_RAIO, LEQUE_RAIOS), ORIGEM, 1, ...JANELAS.sirene)
    abano.linhas.position.set(0, POSTE_ALTURA, POSTE_Z)
    pecas.push(abano)

    // As peças das figuras já moram no grupo delas; todo o resto pendura
    // direto na raiz.
    for (const peca of pecas) {
      if (!peca.linhas.parent) raiz.add(peca.linhas)
    }

    // Um `<div>` e não um quad de tela cheia: custa nada, compõe certo tanto
    // sobre o canvas quanto sobre o artigo, e sai no `dispose()` com o resto.
    const clarao = document.createElement('div')
    clarao.setAttribute('aria-hidden', 'true')
    clarao.style.position = 'fixed'
    clarao.style.inset = '0'
    clarao.style.background = COR_VERDE_QUENTE.getStyle()
    clarao.style.opacity = '0'
    clarao.style.pointerEvents = 'none'
    clarao.style.setProperty('z-index', 'var(--z-veil)')

    // Só agora a montagem toca no mundo de fora: se algo acima jogasse, não
    // teria sobrado nada pendurado na cena nem no DOM.
    ctx.scene.add(raiz)
    ctx.overlay.append(clarao)

    // Registrado no mesmo fôlego em que foi pendurado: entre uma coisa e a
    // outra, um throw deixaria a raiz na cena com `dispose()` sem nada pra
    // desfazer.
    this.ctx = ctx
    this.montagem = {
      raiz,
      pecas,
      figuras,
      onibus: buzu,
      leque: abano,
      clarao,
      claraoOpacidade: '0',
      frustum: new Frustum(),
      matriz: new Matrix4(),
      corRepouso: new Color(VERDE),
      corBorda: new Color(VERDE_QUENTE),
      aux: new Vector3(),
    }

    raiz.updateMatrixWorld(true)
    for (const f of figuras) f.grupo.localToWorld(f.mundo.set(0, CABECA_Y, 0))
  }

  update(dt: number, elapsed: number, progress: number): void {
    const ctx = this.ctx
    const m = this.montagem
    if (!ctx || !m) return

    const reduzido = ctx.quality.reducedMotion

    // Sai pro âmbar com a sirene e volta pro verde antes do fim — contrato
    // item 3. O leitor sai por onde entrou.
    const quente = beat(progress, ...JANELAS.sirene) * (1 - beat(progress, ...JANELAS.regresso))
    m.corRepouso.copy(COR_VERDE).lerp(COR_AMBAR, quente * DERIVA_QUENTE)
    m.corBorda.copy(COR_VERDE_QUENTE).lerp(COR_AMBAR_QUENTE, quente * DERIVA_QUENTE)

    const sumico = 1 - beat(progress, SUMICO_DE, SUMICO_ATE)

    for (const peca of m.pecas) {
      const t = beat(progress, peca.de, peca.ate)
      // Duas bandas além do último vértice, que é a mesma regra do
      // `ScanReveal` (`maxRadius = bounds + BAND * 2`). Parar no último
      // vértice deixa a frente clara em cima dele: o shader só devolve `wave`
      // a zero quando `lead >= uBand`, e a peça nunca chegaria a assentar.
      peca.material.uniforms['uScanRadius']!.value = t * (peca.alcance + 2 * peca.banda)
      peca.material.uniforms['uOpacity']!.value = sumico
      ;(peca.material.uniforms['uRestColor']!.value as Color).copy(m.corRepouso)
      ;(peca.material.uniforms['uEdgeColor']!.value as Color).copy(m.corBorda)
      // A ondulação do shader precisa de tempo real pra viajar — e é a única
      // coisa da rua que anda sem a leitura. Sob movimento reduzido ela para
      // no valor que já tinha, igual o mundo gerado faz.
      if (!reduzido) peca.material.uniforms['uTime']!.value = elapsed
    }

    // Ele existe desde 0.42 e só entra na rua a partir de 0.48. Sob movimento
    // reduzido já nasce parado na guia.
    const chegada = beat(progress, ...JANELAS.chegada)
    m.onibus.linhas.position.z = reduzido
      ? ONIBUS_Z
      : lerp(ONIBUS_Z_PARTIDA, ONIBUS_Z, easeOutCubic(chegada))

    const sirene = beat(progress, ...JANELAS.sirene)
    m.leque.material.uniforms['uOpacity']!.value = sumico * sirene
    if (!reduzido) m.leque.linhas.rotation.y = elapsed * SIRENE_GIRO

    this.virarFiguras(dt, progress, ctx.camera, m, reduzido)

    // Um pico, não um esmaecer: sobe até 0.975 e some antes da última linha.
    const pico =
      beat(progress, JANELAS.clarao[0], CLARAO_PICO) *
      (1 - beat(progress, CLARAO_PICO, JANELAS.clarao[1]))
    const alvo = pico * (reduzido ? CLARAO_REDUZIDO : CLARAO_PICO_TETO)
    // A opacidade só é limitada na subida: arrastar a barra de rolagem rápido
    // não pode empurrar o clarão pra cima mais rápido que o teto de segurança
    // acima, mas descer rápido (o `pico` caindo) não é risco e passa direto.
    const atual = Number(m.claraoOpacidade)
    const opacidadeNum =
      alvo > atual ? Math.min(alvo, atual + CLARAO_SUBIDA_POR_SEGUNDO * dt) : alvo
    const opacidade = opacidadeNum.toFixed(3)
    if (opacidade !== m.claraoOpacidade) {
      m.clarao.style.opacity = opacidade
      m.claraoOpacidade = opacidade
    }
  }

  /**
   * Um frustum e uma matriz só, reaproveitados todo quadro: um `new Frustum()`
   * por figura por quadro seriam oito alocações por quadro à toa.
   */
  private virarFiguras(
    dt: number,
    progress: number,
    camera: PerspectiveCamera,
    m: Montagem,
    reduzido: boolean,
  ): void {
    if (m.figuras.length === 0) return

    if (!reduzido) {
      // Quem atualiza `matrixWorldInverse` é o `render`, que roda depois desta
      // função — sem isto o frustum é o do quadro passado enquanto
      // `anguloAlvo` lê a posição deste, e uma figura entrando em cena rápido
      // seria julgada fora e viraria na borda da tela. Que é exatamente a
      // única coisa que este beat existe pra impedir.
      camera.updateMatrixWorld()
      m.frustum.setFromProjectionMatrix(
        m.matriz.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      )
    }

    for (const f of m.figuras) {
      const deve = progress >= f.virarEm
      if (deve !== f.deveOlhar) {
        // Rolar pra trás desfaz o giro pela mesma regra, senão voltar deixaria
        // um quintal inteiro olhando pra um leitor que ainda não chegou lá.
        f.deveOlhar = deve
        f.virou = false
        f.esperando = 0
        f.girando = false
      }
      if (f.virou) continue

      // Movimento reduzido não espera esconderijo: vira no quadro em que
      // `deveOlhar` mudou, no mesmo ponto de leitura.
      if (reduzido) {
        f.cabeca.rotation.y = this.anguloAlvo(f, deve, camera, m.aux)
        f.virou = true
        continue
      }

      if (!m.frustum.containsPoint(f.mundo)) {
        f.cabeca.rotation.y = this.anguloAlvo(f, deve, camera, m.aux)
        f.virou = true
        f.girando = false
        continue
      }

      f.esperando += dt
      if (f.esperando < ESPERA_MAXIMA) continue

      if (!f.girando) {
        f.girando = true
        f.giroDe = f.cabeca.rotation.y
        // Menor caminho: um giro interrompido e reapontado não pode dar a
        // volta inteira pra chegar onde meia volta chegava.
        const bruto = this.anguloAlvo(f, deve, camera, m.aux) - f.giroDe
        f.giroDelta = Math.atan2(Math.sin(bruto), Math.cos(bruto))
        f.giroT = 0
      }
      f.giroT = Math.min(1, f.giroT + dt / GIRO_SEGUNDOS)
      f.cabeca.rotation.y = f.giroDe + f.giroDelta * easeOutCubic(f.giroT)
      if (f.giroT >= 1) {
        f.virou = true
        f.girando = false
      }
    }
  }

  /**
   * Pra onde a cabeça olha: a câmera, ou de volta pra frente do corpo.
   *
   * Só é chamado no instante de virar, nunca por quadro. Cabeça que persegue a
   * câmera é câmera de segurança; cabeça que virou uma vez e ficou é gente.
   */
  private anguloAlvo(
    f: Figura,
    deve: boolean,
    camera: PerspectiveCamera,
    aux: Vector3,
  ): number {
    if (!deve) return 0
    // No espaço do grupo da figura, que é onde `cabeca.rotation.y` vive.
    const local = f.grupo.worldToLocal(aux.copy(camera.position))
    return Math.atan2(local.x, local.z)
  }

  dispose(): void {
    const m = this.montagem
    if (m) {
      this.ctx?.scene.remove(m.raiz)
      for (const peca of m.pecas) {
        peca.geometria.dispose()
        peca.material.dispose()
      }
      m.raiz.clear()
      m.clarao.remove()
    }
    this.montagem = null
    this.ctx = null
  }
}

/**
 * `new Rua()` e não `Rua`: `loadPostWorld` devolve o default do módulo como um
 * `PostWorldModule`, e o glob guarda o módulo — então este objeto é reusado
 * entre visitas. Todo campo dele nasce em `build` e morre em `dispose`.
 */
export default new Rua()
