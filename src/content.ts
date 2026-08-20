/**
 * Every word on the page.
 *
 * Placeholder copy, written to the right shape and length so the layout is
 * honest. Replacing it is a single-file edit — no markup or styling depends on
 * the specific strings, only on the structure.
 */

export interface Project {
  /** Two-digit index shown in the card's corner. */
  index: string
  title: string
  summary: string
  /** Short technical tags. Three or four reads best; more wraps badly. */
  tags: string[]
  year: string
  /** When present the card becomes a real link; without it, a plain article. */
  href?: string
  /** A single number worth boasting about, or omitted. */
  metric?: { value: string; label: string }
}

export interface Link {
  label: string
  href: string
}

/**
 * Declared with an explicit type rather than inline in an `as const` object:
 * `as const` narrows each entry to its own literal shape, which drops the
 * optional `href` and `metric` from the resulting type altogether.
 */
const projects: Project[] = [
  {
    index: '01',
    title: 'Realtime Canvas Engine',
    summary:
      'A collaborative editing surface holding 60fps with thousands of live nodes. Rebuilt the hit-testing and dirty-region pipeline so interaction cost stopped scaling with document size.',
    tags: ['WebGL', 'CRDT', 'Perf'],
    year: '2025',
    metric: { value: '11×', label: 'faster hit-testing' },
  },
  {
    index: '02',
    title: 'Design System, Third Edition',
    summary:
      'Consolidated four divergent component libraries into one token-driven system adopted by nine product teams, with a codemod path that kept every consumer shipping through the migration.',
    tags: ['Tokens', 'A11y', 'Codemods'],
    year: '2024',
    metric: { value: '9', label: 'teams migrated' },
  },
  {
    index: '03',
    title: 'Streaming Data Explorer',
    summary:
      'Virtualised tables over a websocket firehose, with a query builder that stays responsive while the underlying dataset changes beneath it. Fully keyboard operable.',
    tags: ['React', 'Virtualisation', 'WebSockets'],
    year: '2024',
    metric: { value: '2M', label: 'rows, no jank' },
  },
  {
    index: '04',
    title: 'Frame Budget Toolkit',
    summary:
      'An in-house profiler that attributes dropped frames to the component that caused them. Turned performance work from archaeology into a routine part of code review.',
    tags: ['DevTools', 'Profiling'],
    year: '2023',
  },
  {
    index: '05',
    title: 'Motion Language',
    summary:
      'A documented set of easing curves, durations, and choreography rules, plus the lint rule that keeps them honest. Reduced motion is a first-class path, not an afterthought.',
    tags: ['Motion', 'Docs', 'Lint'],
    year: '2023',
  },
]

const links: Link[] = [
  { label: 'GitHub', href: 'https://github.com/heisenico' },
  { label: 'Email', href: 'mailto:hello@example.com' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
]

export const content = {
  identity: {
    name: 'Nicholas Ferrer',
    role: 'Staff Front-End Engineer',
    eyebrow: 'Portfolio — Rendering, interaction, design systems',
    blurb:
      'I build interfaces where the rendering and the design decisions are the same conversation. Most of my work lives where a design system meets a frame budget.',
    location: 'São Paulo, Brazil',
    availability: 'Available for work',
  },

  sectionTitles: {
    work: 'Selected work',
    contact: 'Elsewhere',
  },

  projects,
  links,

  footer: {
    note: 'Built with Three.js. The cat is procedural, and does not like being looked at.',
    cue: 'Scroll',
  },
}
