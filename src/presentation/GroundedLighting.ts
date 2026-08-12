/**
 * World-fixed grounding cues for actors drawn from baked bitmap art.
 *
 * Every production actor texture bakes one light direction, and the runtime
 * rotates the whole sprite to follow facing. That rotation drags the baked
 * light with it, so a turning actor reads as a flat decal spinning on the road.
 * These helpers restore the cues the rotation destroys: a silhouette cast
 * shadow that always falls the same screen direction, a wet-asphalt reflection
 * under the body, and a rim bias toward the fixed key light.
 *
 * Presentation only. Nothing here decides capture membership, damage, XP, or
 * loop validity.
 */

export interface ScreenOffset {
  readonly x: number;
  readonly y: number;
}

export interface SpriteScale {
  readonly x: number;
  readonly y: number;
}

export interface CastShadowPresentation {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly alpha: number;
}

export interface WetReflectionPresentation {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly alpha: number;
}

/**
 * The quarantine district key light sits high and screen up-left, so shadows
 * fall down-right. The vector is stored pre-normalized.
 */
export const SCENE_SHADOW_DIRECTION: ScreenOffset = Object.freeze({
  x: 0.5583,
  y: 0.8296,
});

export const GROUNDED_LIGHTING = Object.freeze({
  /** Cast shadow distance from the body, in body radii. */
  shadowDistanceInRadii: 0.72,
  shadowAlpha: 0.4,
  /** Foreshortening along the body's long axis as it lies on the road. */
  shadowLongitudinalSquash: 0.82,
  shadowLateralSpread: 1.07,
  /** Wet reflection sits directly below the contact point. */
  reflectionAlpha: 0.17,
  reflectionSquash: 0.66,
  reflectionDropInRadii: 0.22,
  reflectionWobbleInRadii: 0.05,
  reflectionWobbleRate: 1.9,
  /** Rim highlight offset toward the key light, in body radii. */
  rimDistanceInRadii: 0.13,
  rimAlpha: 0.22,
});

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function safeRadius(radius: number): number {
  const resolved = safeNumber(radius, 0);
  return resolved > 0 ? resolved : 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Where an actor's cast shadow lands relative to its body centre. The offset is
 * screen-fixed, so it stays put while the sprite rotates through its facing.
 */
export function resolveShadowOffset(
  radius: number,
  elevation = 1,
): ScreenOffset {
  const reach =
    safeRadius(radius) *
    GROUNDED_LIGHTING.shadowDistanceInRadii *
    clamp01(elevation);

  return Object.freeze({
    x: SCENE_SHADOW_DIRECTION.x * reach,
    y: SCENE_SHADOW_DIRECTION.y * reach,
  });
}

/**
 * Full transform for a silhouette cast shadow drawn from the actor's own
 * texture. `spriteScale` is the already-resolved actor scale so the shadow
 * inherits breathing, stagger, and closure deformation.
 */
export function resolveCastShadow(
  radius: number,
  spriteScale: SpriteScale,
  strength = 1,
): CastShadowPresentation {
  const offset = resolveShadowOffset(radius, strength);
  const scaleX = safeNumber(spriteScale.x, 0);
  const scaleY = safeNumber(spriteScale.y, 0);

  return Object.freeze({
    offsetX: offset.x,
    offsetY: offset.y,
    scaleX: scaleX * GROUNDED_LIGHTING.shadowLateralSpread,
    scaleY: scaleY * GROUNDED_LIGHTING.shadowLongitudinalSquash,
    alpha: GROUNDED_LIGHTING.shadowAlpha * clamp01(strength),
  });
}

/**
 * Mirrored, squashed reflection for the wet road under an actor. The wobble is
 * the only motion component and collapses to zero under reduced motion.
 */
export function resolveWetReflection(
  radius: number,
  spriteScale: SpriteScale,
  elapsed: number,
  phase = 0,
  reducedMotion = false,
): WetReflectionPresentation {
  const resolvedRadius = safeRadius(radius);
  const scaleX = safeNumber(spriteScale.x, 0);
  const scaleY = safeNumber(spriteScale.y, 0);
  const wobble = reducedMotion
    ? 0
    : Math.sin(
        safeNumber(elapsed) * GROUNDED_LIGHTING.reflectionWobbleRate +
          safeNumber(phase),
      ) *
      resolvedRadius *
      GROUNDED_LIGHTING.reflectionWobbleInRadii;

  return Object.freeze({
    offsetX: wobble,
    offsetY: resolvedRadius * GROUNDED_LIGHTING.reflectionDropInRadii,
    scaleX,
    scaleY: -scaleY * GROUNDED_LIGHTING.reflectionSquash,
    alpha: GROUNDED_LIGHTING.reflectionAlpha,
  });
}

/**
 * Screen-fixed offset for the additive rim copy of an actor sprite. It points
 * back toward the key light, which is the opposite of the shadow direction.
 */
export function resolveRimOffset(radius: number): ScreenOffset {
  const reach = safeRadius(radius) * GROUNDED_LIGHTING.rimDistanceInRadii;

  return Object.freeze({
    x: -SCENE_SHADOW_DIRECTION.x * reach,
    y: -SCENE_SHADOW_DIRECTION.y * reach,
  });
}
