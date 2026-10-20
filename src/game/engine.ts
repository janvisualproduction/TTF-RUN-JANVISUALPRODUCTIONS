// Game loop, physics updates, obstacle spawning, and collision detection
import { sound } from './audio';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  GRAVITY,
  JUMP_VELOCITY,
  INITIAL_SPEED,
  MAX_SPEED,
  ACCELERATION_RATE,
  BOY_WIDTH,
  BOY_HEIGHT,
  BOY_X,
  CAR_WIDTH,
  CAR_HEIGHT,
  CAR_Y,
  DIAMOND_SIZE,
  DIAMOND_SPAWN_INTERVAL_METRES,
  BOY_HITBOX_PADDING,
  CAR_HITBOX_PADDING,
  STORAGE_KEY_BEST_SCORE,
} from './constants';
import { GameRenderer } from './renderer';
import type {
  GameState,
  BoyPlayer,
  PoliceCar,
  CollectibleDiamond,
  Particle,
  GameMetrics,
} from './types';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: GameRenderer;
  private state: GameState = 'START';
  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  // Player state
  private boy!: BoyPlayer;

  // World entities
  private policeCars: PoliceCar[] = [];
  private diamonds: CollectibleDiamond[] = [];
  private particles: Particle[] = [];

  // Progression metrics
  private distance: number = 0; // in metres
  private score: number = 0;
  private diamondsCollected: number = 0;
  private bestScore: number = 0;
  private currentSpeed: number = INITIAL_SPEED;

  // Spawning logic
  private nextCarDistance: number = 18; // First car arrives comfortably after ~18m
  private lastSpawnedCarDistance: number = 0;
  private lastDiamondMilestone: number = 0;

  // Visual effects
  private screenShake: number = 0;
  private footstepTimer: number = 0;
  private crashTimer: number = 0;

  // Callbacks for UI updates
  private onStateChange?: (state: GameState) => void;
  private onMetricsUpdate?: (metrics: GameMetrics) => void;
  private onMilestoneNotice?: (text: string) => void;

  // High-DPI display scale ratio
  private dpr: number = 1;

  constructor(
    canvas: HTMLCanvasElement,
    options?: {
      onStateChange?: (state: GameState) => void;
      onMetricsUpdate?: (metrics: GameMetrics) => void;
      onMilestoneNotice?: (text: string) => void;
    }
  ) {
    this.canvas = canvas;
    this.renderer = new GameRenderer(canvas);
    this.resize();

    this.onStateChange = options?.onStateChange;
    this.onMetricsUpdate = options?.onMetricsUpdate;
    this.onMilestoneNotice = options?.onMilestoneNotice;

    // Load persisted best score
    const savedBest = localStorage.getItem(STORAGE_KEY_BEST_SCORE);
    if (savedBest) {
      this.bestScore = parseInt(savedBest, 10) || 0;
    }

    this.resetGame();
  }

  // Handle display resize & high-density pixel ratio safely
  public resize(customDpr?: number) {
    try {
      if (!this.canvas) return;
      const dpr = customDpr || Math.min(window.devicePixelRatio || 1, 3);
      this.dpr = dpr > 0 ? dpr : 1;
      this.canvas.width = Math.round(CANVAS_WIDTH * this.dpr);
      this.canvas.height = Math.round(CANVAS_HEIGHT * this.dpr);

      if (this.state === 'START') {
        this.renderPreviewFrame();
      } else if (this.state === 'PAUSED' || this.state === 'GAMEOVER') {
        this.draw(0);
      }
    } catch {
      // Fallback safely to original dimensions
      if (this.canvas) {
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
      }
    }
  }

  // Reset all game state for a new run
  public resetGame() {
    this.distance = 0;
    this.score = 0;
    this.diamondsCollected = 0;
    this.currentSpeed = INITIAL_SPEED;
    this.nextCarDistance = 18 + Math.random() * 6;
    this.lastSpawnedCarDistance = 0;
    this.lastDiamondMilestone = 0;
    this.screenShake = 0;
    this.crashTimer = 0;

    this.boy = {
      x: BOY_X,
      y: GROUND_Y - BOY_HEIGHT,
      width: BOY_WIDTH,
      height: BOY_HEIGHT,
      vy: 0,
      isGrounded: true,
      runCycle: 0,
      jumpCycle: 0,
      isJumping: false,
      ducking: false,
      diamondGlow: 1,
      hasCollided: false,
      rotation: 0,
      landingTimer: 0,
    };

    this.policeCars = [];
    this.diamonds = [];
    this.particles = [];

    // Reset End SFX flag so it triggers properly in the new run
    sound.resetEndSound();

    this.notifyMetrics();
  }

  // Start the game
  public start() {
    sound.init();
    sound.setPaused(false);
    sound.playGameStart();
    sound.startBGM();

    this.resetGame();
    this.state = 'PLAYING';
    if (this.onStateChange) this.onStateChange('PLAYING');

    this.lastTime = performance.now();
    this.runLoop();
  }

  // Pause the game
  public togglePause() {
    if (this.state === 'PLAYING') {
      this.pause();
    } else if (this.state === 'PAUSED') {
      this.resume();
    }
  }

  // Explicit Pause (e.g. for orientation change to portrait or background tab)
  public pause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      sound.setPaused(true);
      sound.pauseBGM();
      if (this.onStateChange) this.onStateChange('PAUSED');
    }
  }

  // Explicit Resume (e.g. for orientation change back to landscape)
  public resume() {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      sound.setPaused(false);
      sound.resumeBGM();
      this.lastTime = performance.now();
      if (this.onStateChange) this.onStateChange('PLAYING');
      this.runLoop();
    }
  }

  // Jump action (Space, ArrowUp, Click, Tap)
  public jump() {
    if (this.state === 'START') {
      this.start();
      return;
    }

    if (this.state === 'GAMEOVER') {
      this.start();
      return;
    }

    if (this.state !== 'PLAYING') return;

    // Prevent repeated jumping while airborne
    if (this.boy.isGrounded) {
      this.boy.vy = JUMP_VELOCITY;
      this.boy.isGrounded = false;
      this.boy.isJumping = true;
      sound.playJump();

      // Emit jump launch dust particles
      this.emitDust(this.boy.x + 10, GROUND_Y, 8);
    }
  }

  // Fast fall action (ArrowDown)
  public fastFall() {
    if (this.state === 'PLAYING' && !this.boy.isGrounded && this.boy.vy < 300) {
      this.boy.vy = 500;
    }
  }

  // Main game loop
  private runLoop = () => {
    if (this.state === 'PAUSED') {
      return;
    }

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // clamp dt to avoid spiral
    this.lastTime = now;

    this.update(dt);
    this.draw(dt);

    if (this.state === 'PLAYING' || this.state === 'CRASHED' || this.state === 'GAMEOVER') {
      this.animationFrameId = requestAnimationFrame(this.runLoop);
    }
  };

  // Physics and entity updates
  private update(dt: number) {
    if (this.state === 'GAMEOVER') {
      // Scene is 100% frozen in place behind the score panel.
      return;
    }

    if (this.state === 'CRASHED') {
      this.crashTimer += dt;
      // Animate the initial impact debris particles
      this.updateParticles(dt);

      // Settle camera shake quickly to steady frozen view
      if (this.screenShake > 0) {
        this.screenShake = Math.max(0, this.screenShake - dt * 35);
      }

      // After 650ms delay (in 500-800ms range), transition to GAMEOVER and show score panel
      if (this.crashTimer >= 0.65) {
        this.state = 'GAMEOVER';
        if (this.onStateChange) {
          this.onStateChange('GAMEOVER');
        }
      }
      return;
    }

    // 1. Smooth speed acceleration
    this.currentSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + this.distance * ACCELERATION_RATE);
    sound.updateTempo(this.currentSpeed / INITIAL_SPEED);

    // 2. Distance progression (calibrated so 50m milestone takes ~8-12 seconds initially)
    // 30 px ≈ 1 metre in game space
    const distanceDelta = (this.currentSpeed * dt) / 36;
    this.distance += distanceDelta;
    this.score = Math.floor(this.distance * 10 + this.diamondsCollected * 100);

    // Update best score if beaten
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem(STORAGE_KEY_BEST_SCORE, String(this.bestScore));
    }

    // 3. Boy Physics
    // Gravity
    this.boy.vy += GRAVITY * dt;
    this.boy.y += this.boy.vy * dt;

    // Ground collision
    const groundLevel = GROUND_Y - this.boy.height;
    if (this.boy.y >= groundLevel) {
      this.boy.y = groundLevel;
      this.boy.vy = 0;
      if (!this.boy.isGrounded) {
        // Landing impact dust & shock absorption trigger
        this.emitDust(this.boy.x + 10, GROUND_Y, 4);
        this.boy.landingTimer = 0.14; // 140ms knee flexion shock absorption
      }
      this.boy.isGrounded = true;
      this.boy.isJumping = false;
    }

    // Decay landing cushion timer
    if (this.boy.landingTimer && this.boy.landingTimer > 0) {
      this.boy.landingTimer = Math.max(0, this.boy.landingTimer - dt);
    }

    // Stride animation cycle
    if (this.boy.isGrounded) {
      const strideSpeed = (this.currentSpeed / 360) * 16;
      this.boy.runCycle = (this.boy.runCycle + dt * strideSpeed) % (Math.PI * 2);

      // Footstep audio cadence & dust
      this.footstepTimer += dt * strideSpeed;
      if (this.footstepTimer >= Math.PI) {
        this.footstepTimer = 0;
        sound.playFootstep();
        this.emitDust(this.boy.x + 4, GROUND_Y, 1);
      }
    }

    // 4. Milestone Check: Exactly ONE Diamond Spawned Every 50 Metres
    const currentMilestone = Math.floor(this.distance / DIAMOND_SPAWN_INTERVAL_METRES);
    if (currentMilestone > this.lastDiamondMilestone) {
      this.lastDiamondMilestone = currentMilestone;
      this.spawnCollectibleDiamond(currentMilestone * DIAMOND_SPAWN_INTERVAL_METRES);
      if (this.onMilestoneNotice) {
        this.onMilestoneNotice(`💎 ${currentMilestone * 50}m MILESTONE! DIAMOND AHEAD!`);
      }
      sound.playMilestone();
    }

    // 5. Police Car Obstacle Spawner
    this.updatePoliceCarSpawning();

    // 6. Update Police Cars (continuously driving leftward toward the running boy)
    for (let i = this.policeCars.length - 1; i >= 0; i--) {
      const car = this.policeCars[i];
      const totalApproachSpeed = this.currentSpeed + car.driveSpeed;
      car.x -= totalApproachSpeed * dt;

      // Physically realistic wheel rotation: spinning counter-clockwise as car speeds left
      car.wheelRotation = (car.wheelRotation - (totalApproachSpeed * dt) / 14) % (Math.PI * 2);

      // Subtle exhaust smoke puff behind speeding police car
      if (car.x > -80 && car.x < CANVAS_WIDTH + 100 && Math.random() < 0.28) {
        this.emitCarExhaust(car.x + car.width - 4, car.y + car.height - 10);
      }

      // Play Doppler siren alert when car approaches the boy
      if (!car.passed && car.x < this.boy.x + 320) {
        car.passed = true;
        sound.playPoliceSiren();
      }

      // Check collision with player
      if (this.checkCollision(this.boy, car)) {
        this.handleCollisionCrash(car);
        return;
      }

      // Remove car once completely past the boy and off-screen to the left
      if (car.x + car.width < -150) {
        this.policeCars.splice(i, 1);
      }
    }

    // 7. Update Collectible Diamonds
    for (let i = this.diamonds.length - 1; i >= 0; i--) {
      const diamond = this.diamonds[i];
      diamond.x -= this.currentSpeed * dt;
      diamond.bobPhase += dt * 3;
      diamond.y = diamond.baseY + Math.sin(diamond.bobPhase) * 12;

      // Check collection
      if (!diamond.collected && this.checkDiamondCollection(this.boy, diamond)) {
        diamond.collected = true;
        this.diamondsCollected++;
        sound.playDiamond();
        this.emitSparkles(diamond.x, diamond.y, 25);
        if (this.onMilestoneNotice) {
          this.onMilestoneNotice(`✨ DIAMOND COLLECTED! +100 PTS`);
        }
      }

      // Remove diamond when scrolled off-screen
      if (diamond.x + diamond.size < -60) {
        this.diamonds.splice(i, 1);
      }
    }

    // 8. Update Particles
    this.updateParticles(dt);

    // 9. Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    this.notifyMetrics();
  }

  // Spawns police cars beyond the right screen edge with calibrated fair gaps
  private updatePoliceCarSpawning() {
    // Check distance travelled since last car
    const distSinceLastCar = this.distance - this.lastSpawnedCarDistance;

    // Minimum jumpable gap in metres based on current speed
    // Calibrated so player always has time to land and jump again cleanly
    const speedRatio = this.currentSpeed / INITIAL_SPEED;
    const minGapMetres = 18 + speedRatio * 8;

    if (distSinceLastCar >= this.nextCarDistance) {
      // Spawn each new police car safely beyond the right edge of the visible screen
      const carId = Date.now() + Math.random();
      // Drive speed increases smoothly with overall game speed
      const baseDriveSpeed = 220;
      const speedBonus = (this.currentSpeed - INITIAL_SPEED) * 0.40;
      const variation = (Math.random() - 0.5) * 30;
      const driveSpeed = Math.round(baseDriveSpeed + speedBonus + variation);

      const newCar: PoliceCar = {
        id: carId,
        x: CANVAS_WIDTH + 140, // Beyond visible screen right edge
        y: CAR_Y,
        width: CAR_WIDTH,
        height: CAR_HEIGHT,
        speed: this.currentSpeed,
        driveSpeed,
        wheelRotation: 0,
        sirenPhase: Math.random() * Math.PI,
        type: Math.random() > 0.4 ? 'sedan' : 'suv',
        passed: false,
      };

      this.policeCars.push(newCar);
      this.lastSpawnedCarDistance = this.distance;

      // Next car interval (randomized between minGapMetres and minGapMetres + 16m)
      this.nextCarDistance = minGapMetres + Math.random() * 16;
    }
  }

  // Spawns a collectible diamond ahead at the 50m milestone
  private spawnCollectibleDiamond(milestoneMetres: number) {
    // Find if a police car is spawning around this time
    // If so, place diamond higher at peak jump arc (Y = GROUND_Y - 105) for reward!
    // Otherwise place at running height (Y = GROUND_Y - 35) or mid height
    const hasNearbyCar = this.policeCars.some((car) => car.x > CANVAS_WIDTH - 200);
    const diamondY = hasNearbyCar ? GROUND_Y - 110 : GROUND_Y - (Math.random() > 0.5 ? 40 : 95);

    const diamond: CollectibleDiamond = {
      id: Date.now() + milestoneMetres,
      x: CANVAS_WIDTH + 140,
      y: diamondY,
      baseY: diamondY,
      size: DIAMOND_SIZE,
      rotation: 0,
      milestoneDistance: milestoneMetres,
      collected: false,
      bobPhase: Math.random() * Math.PI,
    };

    this.diamonds.push(diamond);
  }

  // Precise Collision Detection between Boy and Police Car
  private checkCollision(boy: BoyPlayer, car: PoliceCar): boolean {
    // Fair hitboxes with padding to prevent cheap deaths
    const boyBox = {
      x: boy.x + BOY_HITBOX_PADDING.left,
      y: boy.y + BOY_HITBOX_PADDING.top,
      width: boy.width - BOY_HITBOX_PADDING.left - BOY_HITBOX_PADDING.right,
      height: boy.height - BOY_HITBOX_PADDING.top - BOY_HITBOX_PADDING.bottom,
    };

    const carBox = {
      x: car.x + CAR_HITBOX_PADDING.left,
      y: car.y + CAR_HITBOX_PADDING.top,
      width: car.width - CAR_HITBOX_PADDING.left - CAR_HITBOX_PADDING.right,
      height: car.height - CAR_HITBOX_PADDING.top - CAR_HITBOX_PADDING.bottom,
    };

    return (
      boyBox.x < carBox.x + carBox.width &&
      boyBox.x + boyBox.width > carBox.x &&
      boyBox.y < carBox.y + carBox.height &&
      boyBox.y + boyBox.height > carBox.y
    );
  }

  // Check if player collects a diamond
  private checkDiamondCollection(boy: BoyPlayer, diamond: CollectibleDiamond): boolean {
    const boyCenter = {
      x: boy.x + boy.width / 2,
      y: boy.y + boy.height / 2,
    };
    const dist = Math.hypot(boyCenter.x - diamond.x, boyCenter.y - diamond.y);
    return dist < (boy.width / 2 + diamond.size + 14);
  }

  // Handle Collision Crash: Freeze everything instantly and show crash impact
  private handleCollisionCrash(car: PoliceCar) {
    // Prevent duplicate crash handling
    if (this.state === 'CRASHED' || this.state === 'GAMEOVER') {
      return;
    }

    this.state = 'CRASHED';
    this.crashTimer = 0;
    this.boy.hasCollided = true;
    this.boy.vy = 0; // Freeze vertical velocity at collision point
    this.boy.isJumping = false;
    this.boy.rotation = 0; // Freeze boy orientation in collision posture
    this.currentSpeed = 0; // Freeze world movement

    sound.pauseBGM();
    sound.playEnd();

    // Sharp camera impact jolt
    this.screenShake = 14;

    // Burst crash explosion debris at the contact point
    const impactX = (this.boy.x + car.x + 30) / 2;
    const impactY = Math.min(this.boy.y + 40, car.y + 20);
    this.emitCrashDebris(impactX, impactY);

    // Freeze score and distance at exact moment of crash
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem(STORAGE_KEY_BEST_SCORE, String(this.bestScore));
    }

    this.notifyMetrics();

    if (this.onStateChange) {
      this.onStateChange('CRASHED');
    }
  }

  // Particle emission helpers
  private emitDust(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y - 2,
        vx: -this.currentSpeed * 0.4 - Math.random() * 40,
        vy: -15 - Math.random() * 30,
        size: 3 + Math.random() * 4,
        color: 'rgba(203, 213, 225, 0.65)',
        alpha: 0.8,
        decay: 2.2 + Math.random() * 1.5,
        shape: 'circle',
      });
    }
  }

  private emitCarExhaust(x: number, y: number) {
    this.particles.push({
      x,
      y: y + (Math.random() - 0.5) * 4,
      vx: 50 + Math.random() * 70, // Drifts backward behind the car
      vy: -10 - Math.random() * 18, // Drifts gently upward
      size: 3 + Math.random() * 4,
      color: 'rgba(148, 163, 184, 0.45)', // Subtle exhaust smoke
      alpha: 0.5,
      decay: 2.4 + Math.random() * 1.4,
      shape: 'circle',
    });
  }

  private emitSparkles(x: number, y: number, count: number) {
    const colors = ['#00f0ff', '#38bdf8', '#cffafe', '#fbbf24', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 1.4 + Math.random() * 1.2,
        shape: 'sparkle',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 8,
      });
    }
  }

  private emitCrashDebris(x: number, y: number) {
    // Red, blue, smoke, and sparks
    const colors = ['#ef4444', '#3b82f6', '#f8fafc', '#fbbf24', '#00f0ff'];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 320;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size: 3 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 1.0 + Math.random() * 1.2,
        shape: Math.random() > 0.5 ? 'shard' : 'sparkle',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 12,
      });
    }
  }

  // Update particles
  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.rotation !== undefined && p.vRot !== undefined) {
        p.rotation += p.vRot * dt;
      }
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // Draw frame
  private draw(dt: number) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Camera shake on collision
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    const isFrozen = this.state === 'CRASHED' || this.state === 'GAMEOVER';
    const effectiveSpeed = isFrozen ? 0 : this.currentSpeed;
    const effectiveDt = isFrozen ? 0 : dt;

    this.renderer.render(
      this.boy,
      this.policeCars,
      this.diamonds,
      this.particles,
      this.distance,
      effectiveSpeed,
      effectiveDt,
      this.boy.hasCollided,
      isFrozen
    );

    ctx.restore();
  }

  // Render a preview frame for the start screen
  public renderPreviewFrame() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Reset positions for hero preview (relaxed standing idle pose)
    this.boy.y = GROUND_Y - this.boy.height;
    this.boy.isGrounded = true;
    this.boy.runCycle = 0;

    // Place one police car in the background
    this.policeCars = [
      {
        id: 1,
        x: CANVAS_WIDTH * 0.72,
        y: CAR_Y,
        width: CAR_WIDTH,
        height: CAR_HEIGHT,
        speed: 0,
        driveSpeed: 0,
        wheelRotation: 0,
        sirenPhase: 1.2,
        type: 'sedan',
        passed: false,
      },
    ];

    // Place a floating diamond
    this.diamonds = [
      {
        id: 101,
        x: CANVAS_WIDTH * 0.45,
        y: GROUND_Y - 90,
        baseY: GROUND_Y - 90,
        size: DIAMOND_SIZE,
        rotation: 0,
        milestoneDistance: 50,
        collected: false,
        bobPhase: 0,
      },
    ];

    this.renderer.render(
      this.boy,
      this.policeCars,
      this.diamonds,
      [],
      0,
      INITIAL_SPEED,
      0.016,
      false
    );

    ctx.restore();
  }

  // Notify UI
  private notifyMetrics() {
    if (this.onMetricsUpdate) {
      this.onMetricsUpdate({
        distance: Math.floor(this.distance),
        score: this.score,
        diamonds: this.diamondsCollected,
        bestScore: this.bestScore,
        speed: Math.round(this.currentSpeed),
        speedMultiplier: parseFloat((this.currentSpeed / INITIAL_SPEED).toFixed(1)),
      });
    }
  }

  public getState(): GameState {
    return this.state;
  }

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    sound.stopBGM();
  }
}
