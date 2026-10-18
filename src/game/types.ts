// Types for TTF RUN game state, entities, and physics

export type GameState = 'START' | 'PLAYING' | 'CRASHED' | 'PAUSED' | 'GAMEOVER';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoyPlayer {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  isGrounded: boolean;
  runCycle: number; // 0 to 1 cycle for stride animation
  jumpCycle: number;
  isJumping: boolean;
  ducking: boolean;
  diamondGlow: number; // 0 to 1 sine pulse
  hasCollided: boolean;
  rotation: number; // used during crash animation
  landingTimer?: number; // landing impact shock absorption timer (seconds)
}

export interface PoliceCar {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  driveSpeed: number; // Independent speed driving toward the boy (px/s)
  wheelRotation: number; // Continuous wheel rotation angle
  sirenPhase: number; // 0 to 1 for strobe timing
  type: 'sedan' | 'suv';
  passed: boolean;
}

export interface CollectibleDiamond {
  id: number;
  x: number;
  y: number;
  baseY: number;
  size: number;
  rotation: number;
  milestoneDistance: number; // The 50m milestone that spawned it
  collected: boolean;
  bobPhase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  shape: 'circle' | 'sparkle' | 'shard';
  rotation?: number;
  vRot?: number;
}

export interface ParallaxLayer {
  offset: number;
  speedFactor: number;
}

export interface GameMetrics {
  distance: number; // in metres
  score: number;
  diamonds: number; // collected diamonds count
  bestScore: number;
  speed: number; // current speed in px/s
  speedMultiplier: number; // e.g. 1.0x to 2.2x
}
