/**
 * Behaviour-driven posture, layered on top of the walk cycle.
 *
 * The gait says where the limbs are in their stride; the stance says what the
 * body is doing about the fight. Keeping them separate means a creature can
 * wind up an attack while still walking, which is what the 2D telegraphs
 * already do — and it keeps this whole layer a pure function of the behaviour
 * string the simulation already publishes.
 *
 * Nothing here reads or changes a rule. A stance is presentation only.
 */

export interface Stance {
  /** Extra forward torso pitch in radians; positive leans into the target. */
  readonly pitch: number;
  /** Extra arm swing in radians; positive raises both arms forward. */
  readonly armLift: number;
  /** Body drop as a fraction of standing height; positive crouches. */
  readonly crouch: number;
  /** Scales the stride. A staggered creature does not walk normally. */
  readonly gaitDamping: number;
}

const NEUTRAL: Stance = Object.freeze({
  pitch: 0,
  armLift: 0,
  crouch: 0,
  gaitDamping: 1,
});

/** Rearing back before a committed move: unmistakable, and readable early. */
const WIND_UP: Stance = Object.freeze({
  pitch: -0.34,
  armLift: -0.75,
  crouch: 0.06,
  gaitDamping: 0.35,
});

/** Committed and travelling: everything thrown forward. */
const LUNGE: Stance = Object.freeze({
  pitch: 0.46,
  armLift: 0.55,
  crouch: 0.1,
  gaitDamping: 1,
});

/** Hit and reeling: slumped, arms loose, stride gone. */
const STAGGER: Stance = Object.freeze({
  pitch: 0.52,
  armLift: 0.3,
  crouch: 0.22,
  gaitDamping: 0.15,
});

/** Armour peeled away: arched open, the moment the loop is meant to punish. */
const EXPOSED: Stance = Object.freeze({
  pitch: -0.5,
  armLift: -0.95,
  crouch: 0,
  gaitDamping: 0.5,
});

/** Winding down after a committed move. */
const RECOVER: Stance = Object.freeze({
  pitch: 0.24,
  armLift: 0.18,
  crouch: 0.12,
  gaitDamping: 0.5,
});

const STANCES: Readonly<Record<string, Stance>> = Object.freeze({
  telegraph: WIND_UP,
  locking: WIND_UP,
  'correcting-in': WIND_UP,
  charge: LUNGE,
  dash: LUNGE,
  mirroring: LUNGE,
  staggered: STAGGER,
  recover: RECOVER,
  cooldown: RECOVER,
  'correcting-out': RECOVER,
  exposed: EXPOSED,
});

const lerpStance = (from: Stance, to: Stance, t: number): Stance =>
  Object.freeze({
    pitch: from.pitch + (to.pitch - from.pitch) * t,
    armLift: from.armLift + (to.armLift - from.armLift) * t,
    crouch: from.crouch + (to.crouch - from.crouch) * t,
    gaitDamping:
      from.gaitDamping + (to.gaitDamping - from.gaitDamping) * t,
  });

/** How long a stagger takes to shake off, for blending back to neutral. */
export const STAGGER_BLEND_SECONDS = 0.45;

export function resolveStance(
  behaviorState: string,
  staggerRemaining = 0,
): Stance {
  const base = STANCES[behaviorState] ?? NEUTRAL;

  // A stagger that is nearly over should already be easing out of the slump,
  // so the creature does not snap upright on the frame the timer expires.
  if (base === STAGGER && Number.isFinite(staggerRemaining)) {
    const remaining = Math.max(0, Math.min(staggerRemaining, STAGGER_BLEND_SECONDS));
    return lerpStance(NEUTRAL, STAGGER, remaining / STAGGER_BLEND_SECONDS);
  }

  return base;
}

export const NEUTRAL_STANCE = NEUTRAL;
