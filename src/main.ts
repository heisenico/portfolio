import './styles/base.css'
import './styles/glass.css'
import './styles/ui.css'
import './styles/prose.css'
import './styles/motion.css'

import { Raycaster, Vector2, Vector3 } from 'three'
import { posts } from 'virtual:posts'
import { CameraRig } from './core/CameraRig'
import { Loop } from './core/Loop'
import { Pointer } from './core/Pointer'
import { Quality } from './core/Quality'
import { buildPath } from './core/routes'
import { Stage } from './core/Stage'
import { Post } from './fx/Post'
import { Router } from './core/Router'
import { PageHost } from './ui/PageHost'
import { BlogPage } from './ui/pages/BlogPage'
import { HomePage } from './ui/pages/HomePage'
import { NotFoundPage } from './ui/pages/NotFoundPage'
import { PostPage } from './ui/pages/PostPage'
import { Intro } from './ui/Intro'
import { installLiquidGlass } from './ui/LiquidGlass'
import { Nav } from './ui/Nav'
import { assignBranches, BranchLabels } from './world/BranchLabels'
import { generateBranches } from './world/BranchSystem'
import { Ground } from './world/Ground'
import { orphanWorlds } from './world/PostWorld'
import { ScanPulse } from './world/ScanPulse'
import { Cat } from './world/Cat'
import { CatBrain } from './world/CatBrain'
import { Motes } from './world/Motes'
import { PointerTrail } from './world/PointerTrail'
import { ScanReveal } from './world/ScanReveal'
import { TrunkRings } from './world/TrunkRings'
import { Fireflies } from './world/Fireflies'
import { Wind } from './world/Wind'
import { agruparPaixoes, paixoes } from './content/paixoes'
import { site } from './content/site'
import type { PaixaoHoverDetail } from './ui/pages/HomePage'

const canvas = document.getElementById('stage') as HTMLCanvasElement

/** `?verify` makes the canvas capturable by external screenshot tooling. */
const VERIFY = new URLSearchParams(location.search).has('verify')

const quality = new Quality()

// O SO é o toggle de tema. Trocar a aparência com o site aberto troca o tema
// ao vivo; o CSS já reage sozinho via @media, isto é só pro mundo.
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => quality.setTema(e.matches ? 'noite' : 'papel'))

const stage = new Stage(canvas, quality, { preserveDrawingBuffer: VERIFY })
const loop = new Loop()
const pointer = new Pointer(stage.camera)
const rig = new CameraRig(stage.camera, pointer, quality)

const SCAN_ORIGIN = new Vector3(0, 6.5, 0)
const TREE_DEPTH = 6

const branches = generateBranches({ origin: SCAN_ORIGIN, depth: TREE_DEPTH })
const scan = new ScanReveal(branches, TREE_DEPTH)
const pulse = new ScanPulse(SCAN_ORIGIN)
const ground = new Ground(SCAN_ORIGIN)
const motes = new Motes(quality, SCAN_ORIGIN)
const trail = new PointerTrail(quality)
const cat = new Cat()
const catBrain = new CatBrain(branches.perches)
const rings = new TrunkRings(agruparPaixoes(paixoes))
const wind = new Wind()
const fireflies = new Fireflies(quality)

// O blog visto de dentro da árvore: cada post ganha um galho de verdade, uma
// vez só no boot — não por rota, pra que a atribuição seja idêntica em /blog
// e num carregamento frio de /blog/:slug.
const labels = new BranchLabels(quality)
const atribuicoes = assignBranches(posts, branches.branches)
labels.setPosts(atribuicoes)
labels.setVisible(false)

stage.scene.add(
  scan.group,
  pulse.mesh,
  ground.mesh,
  motes.points,
  trail.points,
  cat.group,
  rings.group,
  labels.group,
)

// Sob `prefers-reduced-motion`, vagalumes não entram na cena — não é só uma
// questão de deixar de animar, é não desenhar a criatura nenhuma.
if (!quality.reducedMotion) stage.scene.add(fireflies.points)

// A página e o mundo são duas vistas do mesmo fato: passar o mouse numa
// paixão acende o anel dela no tronco.
document.addEventListener('paixao-hover', (event) => {
  rings.setHighlight((event as CustomEvent<PaixaoHoverDetail>).detail.index)
})

// Hover test against the cat's forgiving proxy rather than its assembled parts.
const raycaster = new Raycaster()
const ndc = new Vector2()
let catHovered = false

stage.onResize((size) => {
  motes.setDpr(size.dpr)
  trail.setDpr(size.dpr)
  fireflies.setDpr(size.dpr)
})

const glass = installLiquidGlass()

const host = new PageHost(document.getElementById('ui') as HTMLElement, quality)

const porSlug = new Map(atribuicoes.map((a) => [a.slug, a]))

const router = new Router((match) => {
  nav.setActive(match.name)
  switch (match.name) {
    case 'home':
      void host.show(new HomePage(rig, branches))
      return
    case 'blog':
      void host.show(new BlogPage(rig, labels, posts))
      return
    case 'post': {
      const slug = match.params['slug'] ?? ''
      const post = posts.find((p) => p.slug === slug)
      const atribuicao = porSlug.get(slug)
      if (!post || !atribuicao) {
        // A rota bateu com /blog/:slug, mas nenhum post tem essa slug — a
        // pílula já foi acesa em "blog" na primeira linha do handler; corrige
        // aqui, porque a pílula não deve afirmar que você está numa página
        // em que não está.
        nav.setActive('notFound')
        void host.show(new NotFoundPage(rig, branches))
        return
      }
      void host.show(
        new PostPage(post, atribuicao, rig, labels, stage.scene, stage.camera, quality, wind),
      )
      return
    }
    default:
      void host.show(new NotFoundPage(rig, branches))
  }
})

const nav = new Nav(site.nav)
document.getElementById('nav')?.appendChild(nav.el)

const intro = new Intro(
  scan,
  () => document.getElementById('ui')?.classList.remove('is-waiting'),
  quality,
  document.getElementById('veil'),
)

let scanFrozen = false

// Último NDC visto durante um arraste em curso, pra derivar o delta que
// alimenta `wind.push` sem alocar um vetor novo a cada frame.
const dragPrev = new Vector2()
let dragging = false

const post = new Post(stage, quality)

// Frame the tree from its real extent, and refit whenever the viewport changes.
rig.frame(new Vector3(0, branches.centreY, 0), branches.halfWidth, branches.halfHeight)
stage.onResize(() => rig.refit())

loop.add((dt) => {
  // Keep emitted particles on the plane the tree occupies, whatever the
  // camera distance currently is.
  pointer.focalDistance = rig.radius
  pointer.update(dt)
})
loop.add((dt, elapsed) => rig.update(dt, elapsed))
loop.add((dt, elapsed) => {
  if (!scanFrozen) intro.update(dt)
  scan.update(dt, elapsed)

  // Arrastar a tela empurra o vento. `push` nunca é chamado sob movimento
  // reduzido, que é o que faz `Wind.push` ler como um no-op de fora. Também
  // não é chamado em `/blog/:slug`: lá os galhos entortam com `uWind`
  // (`branch.ts`), mas o mundo sob medida do post pende as próprias peças
  // de um `Group` em coordenadas locais e trava `uWind` em zero — arrastar
  // pra selecionar texto no artigo entortaria o galho por baixo da rua sem
  // mover a rua junto, descolando os dois. `wind.update` abaixo continua
  // rodando sempre, então um vento já em curso ao entrar num post decai
  // sozinho em vez de travar em zero.
  if (!quality.reducedMotion && pointer.isDown && router.current.name !== 'post') {
    if (dragging) wind.push(pointer.ndc.x - dragPrev.x, pointer.ndc.y - dragPrev.y)
    dragPrev.copy(pointer.ndc)
    dragging = true
  } else {
    dragging = false
  }
  wind.update(dt)
  scan.setWind(wind.vector, elapsed)

  pulse.update(dt, elapsed, scan.radius, scan.progress)
  ground.update(dt, elapsed, scan.radius)
  motes.update(dt, elapsed, pointer.world, scan.progress)
  trail.update(dt, pointer)
  rings.update(dt, elapsed, scan.progress)
  labels.update(dt, elapsed, stage.camera)
  if (!quality.reducedMotion) fireflies.update(dt, elapsed, pointer.world)
})

// Raycast the labels only while /blog is the active route, so this and the
// post page's own raycasting (Task 8) never both claim the cursor.
let blogHoverSlug: string | null = null
loop.add(() => {
  if (router.current.name !== 'blog') {
    if (blogHoverSlug !== null) {
      blogHoverSlug = null
      labels.setHighlight(null)
      scan.setLitBranch(null)
      document.body.style.cursor = ''
    }
    return
  }

  ndc.copy(pointer.ndc)
  raycaster.setFromCamera(ndc, stage.camera)
  const slug = labels.hitTest(raycaster)

  if (slug !== blogHoverSlug) {
    blogHoverSlug = slug
    labels.setHighlight(slug)
    scan.setLitBranch(labels.branchIdFor(slug))
  }
  document.body.style.cursor = slug ? 'pointer' : ''
})

canvas.addEventListener('click', () => {
  if (router.current.name !== 'blog' || !blogHoverSlug) return
  router.navigate(buildPath('post', { slug: blogHoverSlug }))
})

loop.add((dt, elapsed) => {
  if (cat.group.visible) {
    ndc.copy(pointer.ndc)
    raycaster.setFromCamera(ndc, stage.camera)
    catHovered = raycaster.intersectObject(cat.proxy, false).length > 0
  } else {
    catHovered = false
  }

  cat.setPose(catBrain.update(dt, catHovered))
  cat.update(dt, elapsed)
})
loop.add((dt) => {
  host.update(dt, pointer)
  rig.setScroll(host.scrollProgress)
})
loop.add(() => quality.sample(loop.frameMs))
loop.add((dt, elapsed) => post.render(dt, elapsed))

// The content waits behind the scan; the intro lifts `is-waiting` when the
// wavefront has cleared the tree.
document.getElementById('ui')?.classList.add('is-waiting')

router.start()
loop.start()
document.documentElement.classList.remove('is-booting')

console.info(
  `[portfolio] tier=${quality.initialTier} glass=${glass.refraction ? 'refracting' : 'fallback'}`,
)

if (import.meta.env.DEV) {
  const orfaos = orphanWorlds(posts.map((p) => p.slug))
  if (orfaos.length) {
    console.warn(
      `[portfolio] mundo sem post: ${orfaos.join(', ')} — renomeou o post e esqueceu o mundo?`,
    )
  }
}

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
  post,
  host,
  router,
  intro,
  glass,
  cat,
  catBrain,
  get catHovered() {
    return catHovered
  },
  motes,
  trail,
  rings,
  scan,
  pulse,
  ground,
  branches,
  labels,
  wind,
  fireflies,
  get blogHoverSlug() {
    return blogHoverSlug
  },
  /**
   * Copy the current drawing buffer into a DOM image over the page.
   *
   * External screen capture reads the compositor, which serves a stale frame
   * for a WebGL canvas — verified: the GL buffer held a gated scan while the
   * capture showed a completed one. An <img> is composited normally, so this
   * is the only capture path that reflects the frame actually rendered.
   * Requires `?verify` for preserveDrawingBuffer.
   */
  snap() {
    let img = document.getElementById('__snap') as HTMLImageElement | null
    if (!img) {
      img = document.createElement('img')
      img.id = '__snap'
      // Between the canvas (z 0) and the UI layer (z 2), so a snapshot shows
      // the rendered world *and* the live DOM content on top of it.
      Object.assign(img.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        zIndex: '1',
        pointerEvents: 'none',
      })
      document.body.appendChild(img)
    }
    img.src = canvas.toDataURL('image/png')
    return img.src.length
  },
  unsnap() {
    document.getElementById('__snap')?.remove()
  },
  /** Pin the wavefront at a fraction of its travel and redraw, for inspection. */
  freezeScan(progress: number) {
    scanFrozen = true
    scan.setRadius(scan.maxRadius * progress)
    pulse.update(0, loop.elapsed, scan.radius, scan.progress)
    ground.update(0, loop.elapsed, scan.radius)
    post.render(0, loop.elapsed)
  },
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
