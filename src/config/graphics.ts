export const GAMEPLAY_COLORS = {
  void: 0x090b0d,
  asphalt: 0x171c20,
  asphaltLight: 0x222a2f,
  rain: 0x6f8189,
  bone: 0xd8d1be,
  tendon: 0x8b7f6b,
  arterial: 0xc9362b,
  arterialBright: 0xf05a4a,
  amber: 0xe8a33a,
  hostileCyan: 0x4ea7a8,
} as const;

export const PLAYGROUND_TUNING = {
  playerSpeed: 238,
  playerRadius: 17,
  minSampleDistance: 9,
  minimumLoopArea: 2_600,
  maxLoopSamples: 256,
  anchorSnapRadius: 26,
  trailSnapRadius: 20,
  closureDurationSeconds: 0.82,
} as const;
