import type { Vec2 } from '../../core/geometry/vector';

export interface CameraBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Camera2DConfig {
  readonly bounds: CameraBounds;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly deadZoneRatioX?: number;
  readonly deadZoneRatioY?: number;
  readonly followSharpness?: number;
}

export interface Camera2DSnapshot {
  /** World-space coordinate shown at the viewport's left edge. */
  readonly x: number;
  /** World-space coordinate shown at the viewport's top edge. */
  readonly y: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly bounds: CameraBounds;
}

const DEFAULT_DEAD_ZONE_RATIO_X = 0.34;
const DEFAULT_DEAD_ZONE_RATIO_Y = 0.28;
const DEFAULT_FOLLOW_SHARPNESS = 9;

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isValidRatio = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

const isFiniteVec2 = (value: Vec2): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y);

const isValidBounds = (bounds: CameraBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const frozenBounds = (bounds: CameraBounds): CameraBounds =>
  Object.freeze({
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
  });

const clampedCameraAxis = (
  value: number,
  minimum: number,
  maximum: number,
  viewportSize: number,
): number => {
  const maximumOrigin = maximum - viewportSize;
  if (maximumOrigin < minimum) {
    return minimum - (viewportSize - (maximum - minimum)) / 2;
  }
  return Math.max(minimum, Math.min(maximumOrigin, value));
};

export class Camera2D {
  private bounds: CameraBounds;
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly deadZoneRatioX: number;
  private readonly deadZoneRatioY: number;
  private readonly followSharpness: number;
  private x = 0;
  private y = 0;

  public constructor(config: Camera2DConfig) {
    const deadZoneRatioX =
      config.deadZoneRatioX ?? DEFAULT_DEAD_ZONE_RATIO_X;
    const deadZoneRatioY =
      config.deadZoneRatioY ?? DEFAULT_DEAD_ZONE_RATIO_Y;
    const followSharpness =
      config.followSharpness ?? DEFAULT_FOLLOW_SHARPNESS;

    if (!isValidBounds(config.bounds)) {
      throw new RangeError('camera bounds must be finite and ordered');
    }
    if (
      !isFinitePositive(config.viewportWidth) ||
      !isFinitePositive(config.viewportHeight)
    ) {
      throw new RangeError('camera viewport dimensions must be positive');
    }
    if (!isValidRatio(deadZoneRatioX) || !isValidRatio(deadZoneRatioY)) {
      throw new RangeError('camera dead-zone ratios must be in [0, 1]');
    }
    if (!isFinitePositive(followSharpness)) {
      throw new RangeError('camera follow sharpness must be positive');
    }

    this.bounds = frozenBounds(config.bounds);
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.deadZoneRatioX = deadZoneRatioX;
    this.deadZoneRatioY = deadZoneRatioY;
    this.followSharpness = followSharpness;
    this.clampToBounds();
  }

  public get snapshot(): Camera2DSnapshot {
    return Object.freeze({
      x: this.x,
      y: this.y,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      bounds: frozenBounds(this.bounds),
    });
  }

  public setBounds(bounds: CameraBounds): void {
    if (!isValidBounds(bounds)) {
      throw new RangeError('camera bounds must be finite and ordered');
    }
    this.bounds = frozenBounds(bounds);
    this.clampToBounds();
  }

  public resize(viewportWidth: number, viewportHeight: number): void {
    if (
      !isFinitePositive(viewportWidth) ||
      !isFinitePositive(viewportHeight)
    ) {
      throw new RangeError('camera viewport dimensions must be positive');
    }

    const centerX = this.x + this.viewportWidth / 2;
    const centerY = this.y + this.viewportHeight / 2;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.x = centerX - viewportWidth / 2;
    this.y = centerY - viewportHeight / 2;
    this.clampToBounds();
  }

  public jumpTo(target: Vec2): void {
    if (!isFiniteVec2(target)) {
      return;
    }
    this.x = target.x - this.viewportWidth / 2;
    this.y = target.y - this.viewportHeight / 2;
    this.clampToBounds();
  }

  public update(target: Vec2, deltaSeconds: number): void {
    if (!isFiniteVec2(target) || !isFinitePositive(deltaSeconds)) {
      return;
    }

    const halfDeadZoneWidth =
      (this.viewportWidth * this.deadZoneRatioX) / 2;
    const halfDeadZoneHeight =
      (this.viewportHeight * this.deadZoneRatioY) / 2;
    const centerX = this.x + this.viewportWidth / 2;
    const centerY = this.y + this.viewportHeight / 2;
    let desiredX = this.x;
    let desiredY = this.y;

    if (target.x < centerX - halfDeadZoneWidth) {
      desiredX = target.x - this.viewportWidth / 2 + halfDeadZoneWidth;
    } else if (target.x > centerX + halfDeadZoneWidth) {
      desiredX = target.x - this.viewportWidth / 2 - halfDeadZoneWidth;
    }

    if (target.y < centerY - halfDeadZoneHeight) {
      desiredY = target.y - this.viewportHeight / 2 + halfDeadZoneHeight;
    } else if (target.y > centerY + halfDeadZoneHeight) {
      desiredY = target.y - this.viewportHeight / 2 - halfDeadZoneHeight;
    }

    desiredX = clampedCameraAxis(
      desiredX,
      this.bounds.minX,
      this.bounds.maxX,
      this.viewportWidth,
    );
    desiredY = clampedCameraAxis(
      desiredY,
      this.bounds.minY,
      this.bounds.maxY,
      this.viewportHeight,
    );

    const followAmount = 1 - Math.exp(-this.followSharpness * deltaSeconds);
    this.x += (desiredX - this.x) * followAmount;
    this.y += (desiredY - this.y) * followAmount;
    this.clampToBounds();
  }

  private clampToBounds(): void {
    this.x = clampedCameraAxis(
      this.x,
      this.bounds.minX,
      this.bounds.maxX,
      this.viewportWidth,
    );
    this.y = clampedCameraAxis(
      this.y,
      this.bounds.minY,
      this.bounds.maxY,
      this.viewportHeight,
    );
  }
}
