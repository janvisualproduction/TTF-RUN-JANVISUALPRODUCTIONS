// Game tuning constants and canvas coordinate specifications

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 540;
export const GROUND_Y = 430; // Ground / road surface Y

// Physics
export const GRAVITY = 1750; // px/s^2
export const JUMP_VELOCITY = -760; // px/s (gives ~0.87s airtime, clears police cars cleanly)
export const FAST_FALL_GRAVITY = 3200; // px/s^2 when holding down arrow

// Speed progression
export const INITIAL_SPEED = 340; // px/s comfortable start
export const MAX_SPEED = 780; // px/s
export const ACCELERATION_RATE = 0.45; // smooth speed increase per metre

// Boy Player dimensions
export const BOY_WIDTH = 58;
export const BOY_HEIGHT = 86;
export const BOY_X = 140;

// Police Car dimensions
export const CAR_WIDTH = 114;
export const CAR_HEIGHT = 52;
export const CAR_Y = GROUND_Y - CAR_HEIGHT; // Grounded on road

// Collectible Diamond
export const DIAMOND_SIZE = 26;
export const DIAMOND_SPAWN_INTERVAL_METRES = 50; // Spawns every 50m

// Hitbox adjustments (fair hitboxes for arcade runner)
export const BOY_HITBOX_PADDING = {
  top: 10,
  bottom: 8,
  left: 14,
  right: 14,
};

export const CAR_HITBOX_PADDING = {
  top: 12,
  bottom: 0,
  left: 14,
  right: 14,
};

// Local storage keys
export const STORAGE_KEY_BEST_SCORE = 'ttf_run_best_score';
export const STORAGE_KEY_BEST_DISTANCE = 'ttf_run_best_distance';
export const STORAGE_KEY_BEST_DIAMONDS = 'ttf_run_best_diamonds';
