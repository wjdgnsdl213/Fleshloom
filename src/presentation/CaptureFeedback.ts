import type { EnemyCaptureProfile } from '../content/enemies';

export type CaptureFeedbackKind = 'miss' | 'captured' | 'armor-peeled';

export interface CaptureFeedbackSubject {
  readonly captureProfile?: EnemyCaptureProfile;
  readonly captureLayer: 'ordinary' | 'peeled' | 'killed';
}

export interface CaptureFeedback {
  readonly kind: CaptureFeedbackKind;
  readonly audioCue: 'ordinary' | 'shell-peeled';
}

/** Chooses one authored feedback beat without changing capture simulation. */
export const classifyCaptureFeedback = (
  capturedCount: number,
  capturedEnemies: readonly CaptureFeedbackSubject[],
): CaptureFeedback => {
  if (!Number.isFinite(capturedCount) || capturedCount <= 0) {
    return Object.freeze({ kind: 'miss', audioCue: 'ordinary' });
  }

  const armorPeeled = capturedEnemies.some(
    (enemy) =>
      enemy.captureProfile === 'armored' &&
      enemy.captureLayer === 'peeled',
  );

  return armorPeeled
    ? Object.freeze({ kind: 'armor-peeled', audioCue: 'shell-peeled' })
    : Object.freeze({ kind: 'captured', audioCue: 'ordinary' });
};
