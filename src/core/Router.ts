/**
 * History-API routing.
 *
 * Client-side so the WebGL context and the tree survive navigation. Rebuilding
 * the scene per page view would cost a second of shader compilation and throw
 * away the camera mid-gesture — and the whole concept depends on it being the
 * same tree throughout.
 */

import { BASE, matchRoute, stripBase, type RouteMatch } from './routes'

export class Router {
  private currentMatch: RouteMatch

  constructor(private handler: (match: RouteMatch) => void) {
    this.currentMatch = matchRoute(stripBase(location.pathname, BASE))
  }

  start(): void {
    addEventListener('popstate', this.onPopState)
    document.addEventListener('click', this.onClick)
    this.handler(this.currentMatch)
  }

  private onPopState = (): void => {
    this.currentMatch = matchRoute(stripBase(location.pathname, BASE))
    this.handler(this.currentMatch)
  }

  private onClick = (event: MouseEvent): void => {
    // Leave the browser in charge of anything that is not a plain left click on
    // an internal link: new tabs, downloads and external hosts must still work.
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const anchor = (event.target as HTMLElement | null)?.closest('a')
    if (!anchor || (anchor.target && anchor.target !== '_self')) return
    if (anchor.hasAttribute('download')) return

    const url = new URL(anchor.href, location.href)
    if (url.origin !== location.origin) return

    event.preventDefault()
    this.navigate(stripBase(url.pathname, BASE))
  }

  navigate(path: string, replace = false): void {
    const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE
    const full = `${base}${path}` || '/'
    if (full === location.pathname) return

    history[replace ? 'replaceState' : 'pushState']({}, '', full)
    this.currentMatch = matchRoute(path)
    scrollTo({ top: 0 })
    this.handler(this.currentMatch)
  }

  get current(): RouteMatch {
    return this.currentMatch
  }

  dispose(): void {
    removeEventListener('popstate', this.onPopState)
    document.removeEventListener('click', this.onClick)
  }
}
