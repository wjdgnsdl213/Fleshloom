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

export type DistrictPropKind =
  | 'response-van'
  | 'bio-barrier'
  | 'floodlight'
  | 'collapsed-shelter';

export type DistrictPropBand = 'background' | 'midground' | 'foreground';

export interface DistrictPropDefinition {
  readonly position: Vec2;
  readonly kind: DistrictPropKind;
  readonly band: DistrictPropBand;
  readonly scale: number;
  readonly depthOffset: number;
}

export const DISTRICT_PROPS: readonly DistrictPropDefinition[] = Object.freeze([
  // Representative hunt viewport: five authored landmarks define a distant
  // quarantine line, readable midground, and near foreground without closing
  // the central loop-making lane around the 1,600 x 900 world start.
  { position: { x: 1_145, y: 620 }, kind: 'bio-barrier', band: 'background', scale: 0.46, depthOffset: 6 },
  { position: { x: 2_075, y: 650 }, kind: 'floodlight', band: 'background', scale: 0.46, depthOffset: 8 },
  { position: { x: 1_105, y: 875 }, kind: 'response-van', band: 'midground', scale: 0.48, depthOffset: 18 },
  { position: { x: 2_130, y: 1_205 }, kind: 'collapsed-shelter', band: 'foreground', scale: 0.5, depthOffset: 20 },
  { position: { x: 1_325, y: 1_220 }, kind: 'bio-barrier', band: 'foreground', scale: 0.5, depthOffset: 6 },
  // Outer-district landmarks keep traversal from returning to an empty tile.
  { position: { x: 410, y: 590 }, kind: 'collapsed-shelter', band: 'background', scale: 0.48, depthOffset: 18 },
  { position: { x: 570, y: 1_455 }, kind: 'bio-barrier', band: 'foreground', scale: 0.46, depthOffset: 6 },
  { position: { x: 2_735, y: 570 }, kind: 'response-van', band: 'background', scale: 0.46, depthOffset: 18 },
  { position: { x: 2_825, y: 1_480 }, kind: 'floodlight', band: 'foreground', scale: 0.44, depthOffset: 8 },
  { position: { x: 520, y: 1_010 }, kind: 'floodlight', band: 'midground', scale: 0.42, depthOffset: 8 },
  { position: { x: 2_690, y: 1_040 }, kind: 'collapsed-shelter', band: 'midground', scale: 0.46, depthOffset: 20 },
]);

/**
 * Raised street debris. Since D-028 these footprints also feed the body
 * colliders in src/content/quarantineColliders.ts: actors can no longer walk
 * through them. They still carry no capture role and no reward — debris is
 * low, so the living tether and the capture polygon pass over it unchanged.
 */
export type DistrictBlockKind = 'slab' | 'crate' | 'rubble' | 'barrier';

export interface DistrictBlockDefinition {
  readonly position: Vec2;
  readonly length: number;
  readonly width: number;
  readonly rotation: number;
  readonly height: number;
  readonly kind: DistrictBlockKind;
}

export const DISTRICT_BLOCKS: readonly DistrictBlockDefinition[] =
  Object.freeze([
    // Only perimeter volumes remain procedural. Interior placeholder boxes are
    // replaced by authored atlas props; all pieces stay presentation-only.
    { position: { x: 300, y: 160 }, length: 128, width: 66, rotation: 0.1, height: 40, kind: 'barrier' },
    { position: { x: 1_120, y: 148 }, length: 118, width: 62, rotation: -0.08, height: 38, kind: 'barrier' },
    { position: { x: 2_260, y: 152 }, length: 124, width: 64, rotation: 0.06, height: 41, kind: 'barrier' },
    { position: { x: 3_020, y: 190 }, length: 110, width: 60, rotation: -0.14, height: 37, kind: 'barrier' },
    { position: { x: 190, y: 1_640 }, length: 120, width: 62, rotation: 0.12, height: 39, kind: 'barrier' },
    { position: { x: 1_500, y: 1_690 }, length: 126, width: 64, rotation: -0.05, height: 40, kind: 'barrier' },
    { position: { x: 2_820, y: 1_672 }, length: 116, width: 60, rotation: 0.16, height: 38, kind: 'barrier' },
    { position: { x: 3_060, y: 1_020 }, length: 112, width: 58, rotation: -0.2, height: 36, kind: 'barrier' },
  ]);

export const DISTRICT_PUDDLES: readonly DistrictPuddleDefinition[] =
  Object.freeze([
    { position: { x: 410, y: 330 }, radiusX: 96, radiusY: 38, rotation: -0.18 },
    { position: { x: 780, y: 1_420 }, radiusX: 142, radiusY: 45, rotation: 0.12 },
    { position: { x: 1_030, y: 690 }, radiusX: 82, radiusY: 32, rotation: -0.3 },
    { position: { x: 1_360, y: 1_130 }, radiusX: 118, radiusY: 40, rotation: 0.2 },
    { position: { x: 1_520, y: 820 }, radiusX: 138, radiusY: 44, rotation: -0.28 },
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
    { position: { x: 1_430, y: 785 }, phase: 2.2 },
    { position: { x: 1_805, y: 1_045 }, phase: 4.1 },
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
  { position: { x: 1_835, y: 690 }, width: 118, height: 68, rotation: 0.14 },
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
