export const HUD_INTEGRITY_PIP_COUNT = 8;

export const filledIntegrityPipCount = (
  hp: number,
  maxHp: number,
  pipCount = HUD_INTEGRITY_PIP_COUNT,
): number => {
  if (
    !Number.isFinite(hp) ||
    !Number.isFinite(maxHp) ||
    maxHp <= 0 ||
    !Number.isInteger(pipCount) ||
    pipCount <= 0
  ) {
    return 0;
  }

  return Math.min(
    pipCount,
    Math.ceil((Math.max(0, hp) / maxHp) * pipCount),
  );
};
