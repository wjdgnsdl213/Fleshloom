import { polygonArea } from '../../core/geometry/polygon';
import {
  closestPointOnSegment,
  segmentIntersection,
} from '../../core/geometry/segments';
import { copyVec2, distanceSquared, type Vec2 } from '../../core/geometry/vector';

export interface LoopPathOptions {
  readonly minSampleDistance: number;
  readonly minimumArea: number;
  readonly maxSamples: number;
  readonly anchorSnapRadius: number;
  readonly trailSnapRadius: number;
}

export type LoopClosureKind =
  | 'direct'
  | 'anchor-snap'
  | 'trail-snap'
  | 'self-intersection';

export interface LoopClosure {
  readonly points: readonly Vec2[];
  readonly area: number;
  readonly kind: LoopClosureKind;
  readonly snapPoint: Vec2;
}

export interface LoopPreview extends LoopClosure {
  readonly valid: boolean;
}

export class LoopPath {
  private points: Vec2[] = [];

  public constructor(private readonly options: LoopPathOptions) {}

  public get active(): boolean {
    return this.points.length > 0;
  }

  public get samples(): readonly Vec2[] {
    return this.points;
  }

  public begin(position: Vec2): void {
    this.points = [copyVec2(position)];
  }

  public sample(position: Vec2): boolean {
    if (!this.active || this.points.length >= this.options.maxSamples) {
      return false;
    }

    const previous = this.points.at(-1)!;
    const minimumDistanceSquared = this.options.minSampleDistance ** 2;

    if (distanceSquared(previous, position) < minimumDistanceSquared) {
      return false;
    }

    this.points.push(copyVec2(position));
    return true;
  }

  public previewArea(position: Vec2): number {
    return this.preview(position)?.area ?? 0;
  }

  public preview(position: Vec2): LoopPreview | null {
    if (!this.active) {
      return null;
    }

    const path = this.pointsWithReleasePosition(position);
    const anchor = path[0]!;
    const anchorCandidate = this.anchorSnapCandidate(path, position, anchor);
    const intersectionCandidate = this.selfIntersectionCandidate(path);
    const trailCandidate = this.trailSnapCandidate(path, position);
    const selected =
      anchorCandidate ??
      intersectionCandidate ??
      trailCandidate ??
      this.createCandidate(path, 'direct', anchor);

    return {
      ...selected,
      valid: selected.area >= this.options.minimumArea,
    };
  }

  public complete(position: Vec2): LoopClosure | null {
    const preview = this.preview(position);
    this.points = [];

    if (preview === null || !preview.valid) {
      return null;
    }

    return {
      points: preview.points,
      area: preview.area,
      kind: preview.kind,
      snapPoint: preview.snapPoint,
    };
  }

  public cancel(): void {
    this.points = [];
  }

  private pointsWithReleasePosition(position: Vec2): Vec2[] {
    const completedPoints = this.points.map(copyVec2);
    const previous = completedPoints.at(-1);

    if (previous === undefined || distanceSquared(previous, position) > 1) {
      completedPoints.push(copyVec2(position));
    }

    return completedPoints;
  }

  private anchorSnapCandidate(
    path: readonly Vec2[],
    position: Vec2,
    anchor: Vec2,
  ): LoopClosure | null {
    if (
      distanceSquared(position, anchor) > this.options.anchorSnapRadius ** 2
    ) {
      return null;
    }

    return this.validSnapCandidate(path, 'anchor-snap', anchor);
  }

  private trailSnapCandidate(
    path: readonly Vec2[],
    position: Vec2,
  ): LoopClosure | null {
    if (path.length < 4) {
      return null;
    }

    let best:
      | {
          readonly segmentIndex: number;
          readonly point: Vec2;
          readonly distanceSquared: number;
        }
      | undefined;

    const lastEligibleSegment = path.length - 4;

    for (let index = 0; index <= lastEligibleSegment; index += 1) {
      const projection = closestPointOnSegment(
        position,
        path[index]!,
        path[index + 1]!,
      );

      if (projection.distanceSquared > this.options.trailSnapRadius ** 2) {
        continue;
      }

      if (
        best === undefined ||
        projection.distanceSquared < best.distanceSquared
      ) {
        best = {
          segmentIndex: index,
          point: projection.point,
          distanceSquared: projection.distanceSquared,
        };
      }
    }

    if (best === undefined) {
      return null;
    }

    const candidatePath = [
      best.point,
      ...path.slice(best.segmentIndex + 1),
    ];
    return this.validSnapCandidate(candidatePath, 'trail-snap', best.point);
  }

  private selfIntersectionCandidate(path: readonly Vec2[]): LoopClosure | null {
    if (path.length < 4) {
      return null;
    }

    for (let laterIndex = path.length - 2; laterIndex >= 2; laterIndex -= 1) {
      let bestForLaterSegment:
        | {
            readonly earlierIndex: number;
            readonly point: Vec2;
            readonly secondT: number;
          }
        | undefined;

      for (let earlierIndex = 0; earlierIndex < laterIndex - 1; earlierIndex += 1) {
        const intersection = segmentIntersection(
          path[earlierIndex]!,
          path[earlierIndex + 1]!,
          path[laterIndex]!,
          path[laterIndex + 1]!,
        );

        if (intersection === null) {
          continue;
        }

        if (
          bestForLaterSegment === undefined ||
          intersection.secondT < bestForLaterSegment.secondT
        ) {
          bestForLaterSegment = {
            earlierIndex,
            point: intersection.point,
            secondT: intersection.secondT,
          };
        }
      }

      if (bestForLaterSegment !== undefined) {
        const candidatePath = [
          bestForLaterSegment.point,
          ...path.slice(bestForLaterSegment.earlierIndex + 1, laterIndex + 1),
        ];
        const candidate = this.validSnapCandidate(
          candidatePath,
          'self-intersection',
          bestForLaterSegment.point,
        );

        if (candidate !== null) {
          return candidate;
        }
      }
    }

    return null;
  }

  private validSnapCandidate(
    points: readonly Vec2[],
    kind: Exclude<LoopClosureKind, 'direct'>,
    snapPoint: Vec2,
  ): LoopClosure | null {
    const candidate = this.createCandidate(points, kind, snapPoint);
    return candidate.area >= this.options.minimumArea ? candidate : null;
  }

  private createCandidate(
    points: readonly Vec2[],
    kind: LoopClosureKind,
    snapPoint: Vec2,
  ): LoopClosure {
    const copiedPoints = points.map(copyVec2);
    return {
      points: copiedPoints,
      area: polygonArea(copiedPoints),
      kind,
      snapPoint: copyVec2(snapPoint),
    };
  }
}
