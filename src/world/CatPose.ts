/**
 * The contract between the cat's behaviour and the cat's body.
 *
 * `CatBrain` produces one of these per frame and knows nothing about geometry;
 * `Cat` consumes one per frame and knows nothing about behaviour. Keeping the
 * type in its own module means neither has to import the other.
 */

import type { Vector3 } from 'three'

export interface CatPose {
  /** World position of the cat's feet. */
  position: Vector3
  /** Yaw in radians. */
  facing: number
  /** 0 standing tall, 1 fully crouched. */
  crouch: number
  /** -1 stretched along the direction of travel, 0 neutral, 1 squashed. */
  squash: number
  /** Advances continuously; drives the tail wave. */
  tailPhase: number
  /** 0 relaxed, 1 pinned back and alert. */
  earPerk: number
  /** How much the tail counterweights — high while balancing on a branch. */
  balance: number
  visible: boolean
  /** 0..1 fade, so the cat can dissolve rather than vanish. */
  opacity: number
}
