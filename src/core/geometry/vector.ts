export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function copyVec2(point: Vec2): Vec2 {
  return { x: point.x, y: point.y };
}

export function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

export function lerpVec2(a: Vec2, b: Vec2, amount: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
  };
}

