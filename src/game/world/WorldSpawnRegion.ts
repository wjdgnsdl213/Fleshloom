import type { Camera2DSnapshot, CameraBounds } from './Camera2D';

export interface OffscreenSpawnRegionConfig {
  readonly cameraMargin: number;
  readonly bandDepth: number;
  readonly flankPadding: number;
  readonly minimumDepth: number;
  readonly minimumSpan: number;
}

const isFiniteNonNegative = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

const isValidBounds = (bounds: CameraBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const frozenBounds = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): CameraBounds => Object.freeze({ minX, minY, maxX, maxY });

export const selectOffscreenSpawnRegion = (
  camera: Camera2DSnapshot,
  worldBounds: CameraBounds,
  preferredSideIndex: number,
  config: OffscreenSpawnRegionConfig,
): CameraBounds | null => {
  if (
    !isValidBounds(worldBounds) ||
    !Number.isFinite(camera.x) ||
    !Number.isFinite(camera.y) ||
    !Number.isFinite(camera.viewportWidth) ||
    camera.viewportWidth <= 0 ||
    !Number.isFinite(camera.viewportHeight) ||
    camera.viewportHeight <= 0 ||
    !Number.isInteger(preferredSideIndex) ||
    !isFiniteNonNegative(config.cameraMargin) ||
    !isFiniteNonNegative(config.bandDepth) ||
    !isFiniteNonNegative(config.flankPadding) ||
    !isFiniteNonNegative(config.minimumDepth) ||
    !isFiniteNonNegative(config.minimumSpan)
  ) {
    return null;
  }

  const visibleLeft = camera.x;
  const visibleTop = camera.y;
  const visibleRight = camera.x + camera.viewportWidth;
  const visibleBottom = camera.y + camera.viewportHeight;
  const verticalMin = Math.max(
    worldBounds.minY,
    visibleTop - config.flankPadding,
  );
  const verticalMax = Math.min(
    worldBounds.maxY,
    visibleBottom + config.flankPadding,
  );
  const horizontalMin = Math.max(
    worldBounds.minX,
    visibleLeft - config.flankPadding,
  );
  const horizontalMax = Math.min(
    worldBounds.maxX,
    visibleRight + config.flankPadding,
  );
  const candidates: readonly CameraBounds[] = [
    frozenBounds(
      Math.max(
        worldBounds.minX,
        visibleRight + config.cameraMargin,
      ),
      verticalMin,
      Math.min(
        worldBounds.maxX,
        visibleRight + config.cameraMargin + config.bandDepth,
      ),
      verticalMax,
    ),
    frozenBounds(
      horizontalMin,
      Math.max(
        worldBounds.minY,
        visibleBottom + config.cameraMargin,
      ),
      horizontalMax,
      Math.min(
        worldBounds.maxY,
        visibleBottom + config.cameraMargin + config.bandDepth,
      ),
    ),
    frozenBounds(
      Math.max(
        worldBounds.minX,
        visibleLeft - config.cameraMargin - config.bandDepth,
      ),
      verticalMin,
      Math.min(worldBounds.maxX, visibleLeft - config.cameraMargin),
      verticalMax,
    ),
    frozenBounds(
      horizontalMin,
      Math.max(
        worldBounds.minY,
        visibleTop - config.cameraMargin - config.bandDepth,
      ),
      horizontalMax,
      Math.min(worldBounds.maxY, visibleTop - config.cameraMargin),
    ),
  ];
  const start = ((preferredSideIndex % candidates.length) + candidates.length) %
    candidates.length;

  for (let offset = 0; offset < candidates.length; offset += 1) {
    const sideIndex = (start + offset) % candidates.length;
    const candidate = candidates[sideIndex]!;
    const width = candidate.maxX - candidate.minX;
    const height = candidate.maxY - candidate.minY;
    const depth = sideIndex % 2 === 0 ? width : height;
    const span = sideIndex % 2 === 0 ? height : width;

    if (
      depth >= config.minimumDepth &&
      span >= config.minimumSpan
    ) {
      return candidate;
    }
  }

  return null;
};
