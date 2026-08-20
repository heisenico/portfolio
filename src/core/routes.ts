/**
 * Route table.
 *
 * Pure string work, kept apart from `Router` so the rules are testable without
 * a DOM or a history stack. `BASE` matters because the site is served from a
 * subdirectory on GitHub Pages, and every internal link has to survive that.
 */

export type RouteName = 'home' | 'blog' | 'post' | 'notFound'

export interface RouteMatch {
  name: RouteName
  params: Record<string, string>
  path: string
}

export const BASE: string = import.meta.env.BASE_URL || '/'

/** Remove the deploy base prefix, always returning a leading-slash path. */
export function stripBase(pathname: string, base: string): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  let path = pathname
  if (trimmed && (path === trimmed || path.startsWith(`${trimmed}/`))) {
    path = path.slice(trimmed.length)
  }
  return path.startsWith('/') ? path : `/${path}`
}

export function matchRoute(path: string): RouteMatch {
  // Normalise the trailing slash so /blog and /blog/ are one route.
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path

  if (clean === '' || clean === '/') return { name: 'home', params: {}, path: clean }
  if (clean === '/blog') return { name: 'blog', params: {}, path: clean }

  const post = /^\/blog\/([^/]+)$/.exec(clean)
  if (post) {
    return { name: 'post', params: { slug: decodeURIComponent(post[1]!) }, path: clean }
  }

  return { name: 'notFound', params: {}, path: clean }
}

export function buildPath(name: RouteName, params: Record<string, string> = {}): string {
  switch (name) {
    case 'home':
      return '/'
    case 'blog':
      return '/blog'
    case 'post':
      return `/blog/${encodeURIComponent(params['slug'] ?? '')}`
    default:
      return '/404'
  }
}

/** Prefix a route path with the deploy base, for use in an `href`. */
export function href(path: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE
  return `${base}${path}` || '/'
}
