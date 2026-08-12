import type { Vec2 } from '../core/geometry/vector';

export interface DistrictPuddleDefinition {
  readonly position: Vec2;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotation: number;
}

export interface DistrictLightDefinition {
  readonly position: Vec2;
  readonly phase: number;
}

export interface DistrictVentDefinition {
  readonly position: Vec2;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface DistrictBiomassDefinition {
  readonly origin: Vec2;
  readonly inwardAngle: number;
  readonly spread: number;
  readonly massCount: number;
}

export interface DistrictCrosswalkDefinition {
  readonly position: Vec2;
  readonly rotation: number;
  readonly stripeCount: number;
  readonly stripeLength: number;
  readonly stripeWidth: number;
  readonly stripeGap: number;
}

export const DISTRICT_PUDDLES: readonly DistrictPuddleDefinition[] =
  Object.freeze([
    { position: { x: 410, y: 330 }, radiusX: 96, radiusY: 38, rotation: -0.18 },
    { position: { x: 780, y: 1_420 }, radiusX: 142, radiusY: 45, rotation: 0.12 },
    { position: { x: 1_030, y: 690 }, radiusX: 82, radiusY: 32, rotation: -0.3 },
    { position: { x: 1_360, y: 1_130 }, radiusX: 118, radiusY: 40, rotation: 0.2 },
    { position: { x: 1_640, y: 410 }, radiusX: 132, radiusY: 42, rotation: -0.08 },
    { position: { x: 1_860, y: 1_520 }, radiusX: 104, radiusY: 34, rotation: 0.26 },
    { position: { x: 2_170, y: 840 }, radiusX: 150, radiusY: 48, rotation: -0.22 },
    { position: { x: 2_520, y: 1_270 }, radiusX: 94, radiusY: 37, rotation: 0.14 },
    { position: { x: 2_810, y: 390 }, radiusX: 126, radiusY: 42, rotation: 0.04 },
    { position: { x: 3_020, y: 1_560 }, radiusX: 82, radiusY: 30, rotation: -0.16 },
  ]);

export const DISTRICT_LIGHTS: readonly DistrictLightDefinition[] =
  Object.freeze([
    { position: { x: 150, y: 250 }, phase: 0.2 },
    { position: { x: 820, y: 72 }, phase: 1.7 },
    { position: { x: 1_610, y: 72 }, phase: 3.1 },
    { position: { x: 2_420, y: 72 }, phase: 4.4 },
    { position: { x: 3_050, y: 310 }, phase: 0.9 },
    { position: { x: 3_125, y: 1_210 }, phase: 2.5 },
    { position: { x: 2_390, y: 1_728 }, phase: 4.9 },
    { position: { x: 1_570, y: 1_728 }, phase: 1.1 },
    { position: { x: 740, y: 1_728 }, phase: 3.7 },
    { position: { x: 72, y: 1_080 }, phase: 5.2 },
  ]);

export const DISTRICT_VENTS: readonly DistrictVentDefinition[] = Object.freeze([
  { position: { x: 250, y: 520 }, width: 116, height: 70, rotation: -0.18 },
  { position: { x: 590, y: 1_640 }, width: 104, height: 62, rotation: 0.06 },
  { position: { x: 1_140, y: 142 }, width: 122, height: 68, rotation: -0.04 },
  { position: { x: 2_020, y: 1_658 }, width: 112, height: 66, rotation: 0.03 },
  { position: { x: 2_650, y: 138 }, width: 106, height: 64, rotation: 0.1 },
  { position: { x: 3_030, y: 760 }, width: 118, height: 68, rotation: 0.2 },
]);

export const DISTRICT_BIOMASS: readonly DistrictBiomassDefinition[] =
  Object.freeze([
    { origin: { x: 30, y: 330 }, inwardAngle: 0.05, spread: 190, massCount: 8 },
    { origin: { x: 530, y: 25 }, inwardAngle: Math.PI / 2, spread: 170, massCount: 7 },
    { origin: { x: 1_920, y: 24 }, inwardAngle: Math.PI / 2, spread: 230, massCount: 9 },
    { origin: { x: 3_174, y: 490 }, inwardAngle: Math.PI, spread: 190, massCount: 8 },
    { origin: { x: 3_174, y: 1_480 }, inwardAngle: Math.PI, spread: 220, massCount: 9 },
    { origin: { x: 2_420, y: 1_776 }, inwardAngle: -Math.PI / 2, spread: 210, massCount: 8 },
    { origin: { x: 980, y: 1_776 }, inwardAngle: -Math.PI / 2, spread: 180, massCount: 7 },
    { origin: { x: 24, y: 1_280 }, inwardAngle: 0, spread: 230, massCount: 9 },
  ]);

export const DISTRICT_CROSSWALKS: readonly DistrictCrosswalkDefinition[] =
  Object.freeze([
    {
      position: { x: 840, y: 640 },
      rotation: -0.08,
      stripeCount: 7,
      stripeLength: 170,
      stripeWidth: 13,
      stripeGap: 15,
    },
    {
      position: { x: 1_650, y: 1_220 },
      rotation: Math.PI / 2 + 0.06,
      stripeCount: 8,
      stripeLength: 180,
      stripeWidth: 13,
      stripeGap: 15,
    },
    {
      position: { x: 2_560, y: 610 },
      rotation: -0.12,
      stripeCount: 7,
      stripeLength: 164,
      stripeWidth: 12,
      stripeGap: 14,
    },
  ]);
