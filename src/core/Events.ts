/**
 * A typed pub/sub with no dependencies.
 *
 * Used only where a direct reference would force a subsystem to know about
 * something above it in the wiring — the intro announcing that the scan has
 * finished, for instance. Everything else takes its collaborators in the
 * constructor.
 */

export type Handler<T> = (payload: T) => void

export class Emitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>()

  on<K extends keyof Events>(key: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers.get(key)
    if (!set) {
      set = new Set()
      this.handlers.set(key, set)
    }
    set.add(fn as Handler<never>)
    return () => this.off(key, fn)
  }

  once<K extends keyof Events>(key: K, fn: Handler<Events[K]>): () => void {
    const off = this.on(key, (payload) => {
      off()
      fn(payload)
    })
    return off
  }

  off<K extends keyof Events>(key: K, fn: Handler<Events[K]>): void {
    this.handlers.get(key)?.delete(fn as Handler<never>)
  }

  emit<K extends keyof Events>(key: K, payload: Events[K]): void {
    const set = this.handlers.get(key)
    if (!set) return
    // Copy first: a handler may unsubscribe itself while we iterate.
    for (const fn of [...set]) (fn as Handler<Events[K]>)(payload)
  }
}

export interface WorldEvents {
  /** The scan wavefront has passed the far edge of the tree. */
  scanComplete: void
  /** The intro has finished or been skipped. */
  introDone: void
  /** The cat changed behavioural state. */
  catState: string
}
