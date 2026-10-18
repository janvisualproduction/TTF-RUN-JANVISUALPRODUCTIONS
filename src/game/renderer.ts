// High-performance canvas renderer for TTF RUN
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
} from './constants';
import type { BoyPlayer, PoliceCar, CollectibleDiamond, Particle } from './types';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private clouds: { x: number; y: number; scale: number; speed: number }[] = [];
  private stars: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];
  private cityBuildings: { x: number; width: number; height: number; windows: { x: number; y: number; lit: boolean }[] }[] = [];
  private palmTrees: { x: number; height: number }[] = [];
  private streetLights: { x: number }[] = [];
  private roadStripesOffset = 0;

  // Authentic TTF Vasan face sprite loaded from uploaded image
  private faceSprite: HTMLCanvasElement | HTMLImageElement | null = null;
  private faceLoaded: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;

    this.loadFaceImage();
    this.initBackgroundElements();
  }

  private loadFaceImage() {
    const img = new Image();
    img.src = '/assets/ttf-vasan-face.png';

    const onReady = () => {
      try {
        // Pre-filter a 2x supersampled sharp sprite for ultra-crisp display at 60 FPS
        const targetW = 88;
        const targetH = Math.round(targetW * (img.height / img.width));
        const off = document.createElement('canvas');
        off.width = targetW;
        off.height = targetH;
        const octx = off.getContext('2d');
        if (octx) {
          octx.imageSmoothingEnabled = true;
          octx.imageSmoothingQuality = 'high';
          octx.drawImage(img, 0, 0, targetW, targetH);
          this.faceSprite = off;
        } else {
          this.faceSprite = img;
        }
      } catch {
        this.faceSprite = img;
      }
      this.faceLoaded = true;
    };

    if (img.complete && img.naturalWidth > 0) {
      onReady();
    } else {
      img.onload = onReady;
    }
  }

  private initBackgroundElements() {
    // 1. Clouds
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: Math.random() * CANVAS_WIDTH * 1.5,
        y: 40 + Math.random() * 120,
        scale: 0.6 + Math.random() * 0.8,
        speed: 15 + Math.random() * 25,
      });
    }

    // 2. Stars for night time
    for (let i = 0; i < 45; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (GROUND_Y - 140),
        size: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.7,
        speed: 0.5 + Math.random() * 1.5,
      });
    }

    // 3. City skyline buildings
    let bx = 0;
    while (bx < CANVAS_WIDTH * 2) {
      const bw = 50 + Math.random() * 70;
      const bh = 100 + Math.random() * 160;
      const windows: { x: number; y: number; lit: boolean }[] = [];
      for (let wy = 15; wy < bh - 20; wy += 22) {
        for (let wx = 8; wx < bw - 12; wx += 14) {
          windows.push({ x: wx, y: wy, lit: Math.random() > 0.45 });
        }
      }
      this.cityBuildings.push({ x: bx, width: bw, height: bh, windows });
      bx += bw + 8 + Math.random() * 15;
    }

    // 4. Palm trees
    let px = 0;
    while (px < CANVAS_WIDTH * 2) {
      this.palmTrees.push({ x: px, height: 110 + Math.random() * 30 });
      px += 180 + Math.random() * 220;
    }

    // 5. Street lights
    let sx = 0;
    while (sx < CANVAS_WIDTH * 2) {
      this.streetLights.push({ x: sx });
      sx += 320;
    }
  }

  // Calculate day/night cycle colors based on distance
  private getTimeColors(distance: number) {
    // 800m cycle: 0-250m Day, 250-450m Sunset, 450-700m Night, 700-800m Dawn
    const cycle = (distance % 800) / 800;

    if (cycle < 0.3) {
      // Daytime (Bright tropical sky)
      return {
        skyTop: '#1e88e5',
        skyBottom: '#90caf9',
        sunColor: '#fff176',
        sunY: 90,
        isNight: false,
        starAlpha: 0,
        cityColor: 'rgba(25, 45, 80, 0.4)',
        roadColor: '#2b313e',
        ambientLight: 1,
      };
    } else if (cycle < 0.55) {
      // Golden Sunset / Dusk
      const t = (cycle - 0.3) / 0.25;
      return {
        skyTop: '#4a154b',
        skyBottom: '#ff7043',
        sunColor: '#ffb74d',
        sunY: 90 + t * 90,
        isNight: false,
        starAlpha: t * 0.4,
        cityColor: 'rgba(40, 20, 50, 0.65)',
        roadColor: '#222630',
        ambientLight: 0.85,
      };
    } else if (cycle < 0.85) {
      // Deep Neon Night
      return {
        skyTop: '#060914',
        skyBottom: '#101a35',
        sunColor: '#e0e7ff', // Moon
        sunY: 70,
        isNight: true,
        starAlpha: 0.9,
        cityColor: 'rgba(10, 16, 32, 0.9)',
        roadColor: '#151922',
        ambientLight: 0.7,
      };
    } else {
      // Dawn / Sunrise
      const t = (cycle - 0.85) / 0.15;
      return {
        skyTop: '#281a4c',
        skyBottom: '#f48fb1',
        sunColor: '#ffcc80',
        sunY: 140 - t * 50,
        isNight: false,
        starAlpha: (1 - t) * 0.5,
        cityColor: 'rgba(30, 25, 55, 0.55)',
        roadColor: '#242a35',
        ambientLight: 0.85,
      };
    }
  }

  // Main render pass
  public render(
    boy: BoyPlayer,
    policeCars: PoliceCar[],
    diamonds: CollectibleDiamond[],
    particles: Particle[],
    distance: number,
    gameSpeed: number,
    dt: number,
    isCollided: boolean,
    isFrozen: boolean = false
  ) {
    const timeColors = this.getTimeColors(distance);

    // 1. Render Sky Gradient (frozen with distance)
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, timeColors.skyTop);
    skyGrad.addColorStop(1, timeColors.skyBottom);
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);

    // 2. Celestial Body (Sun or Moon)
    this.renderCelestial(timeColors);

    // 3. Stars (twinkling in night/dusk, frozen during crash)
    if (timeColors.starAlpha > 0.05) {
      this.renderStars(timeColors.starAlpha, isFrozen ? 0 : dt);
    }

    // 4. Clouds (parallax layer 1: 100% frozen when isFrozen)
    this.renderClouds(isFrozen ? 0 : gameSpeed, isFrozen ? 0 : dt);

    // 5. Distant City Skyline (parallax layer 2: 100% frozen when isFrozen)
    this.renderCity(isFrozen ? 0 : gameSpeed, isFrozen ? 0 : dt, timeColors, isFrozen);

    // 6. Midground: Palm Trees & Highway Streetlights (parallax layer 3: 100% frozen when isFrozen)
    this.renderMidground(isFrozen ? 0 : gameSpeed, isFrozen ? 0 : dt, timeColors);

    // 7. Ground / Highway Road & Curbs (100% frozen stripes when isFrozen)
    this.renderHighway(isFrozen ? 0 : gameSpeed, isFrozen ? 0 : dt, timeColors);

    // 8. Collectible Diamonds
    this.renderDiamonds(diamonds);

    // 9. Police Car Obstacles (frozen positions and strobes when isFrozen)
    this.renderPoliceCars(policeCars, isFrozen ? 0 : dt);

    // 10. Dust & Sparkle Particles (behind and around player)
    this.renderParticles(particles);

    // 11. TTF Boy Hero with Authentic Uploaded Face
    this.renderBoy(boy, isCollided, timeColors);

    // 12. Dynamic Screen Overlays (flashing police emergency alert light if car is close, hidden when frozen)
    if (!isFrozen) {
      this.renderSirenScreenGlow(policeCars);
    }
  }

  // Render Sun or Moon
  private renderCelestial(timeColors: ReturnType<typeof this.getTimeColors>) {
    this.ctx.save();
    const cx = CANVAS_WIDTH * 0.82;
    const cy = timeColors.sunY;

    if (timeColors.isNight) {
      // Glowing Crescent Moon
      this.ctx.shadowColor = '#67e8f9';
      this.ctx.shadowBlur = 24;
      this.ctx.fillStyle = '#f1f5f9';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      this.ctx.fill();

      // Shadow cutout for crescent
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = timeColors.skyTop;
      this.ctx.beginPath();
      this.ctx.arc(cx - 10, cy - 6, 24, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Radiant Sun
      const glowGrad = this.ctx.createRadialGradient(cx, cy, 10, cx, cy, 75);
      glowGrad.addColorStop(0, timeColors.sunColor);
      glowGrad.addColorStop(0.4, 'rgba(255, 235, 59, 0.4)');
      glowGrad.addColorStop(1, 'rgba(255, 235, 59, 0)');
      this.ctx.fillStyle = glowGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 75, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  // Render Twinkling Stars
  private renderStars(alpha: number, dt: number) {
    this.ctx.save();
    for (const star of this.stars) {
      star.alpha += (Math.random() - 0.5) * dt * 4;
      star.alpha = Math.max(0.2, Math.min(1, star.alpha));

      this.ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  // Render Soft Fluffy Clouds
  private renderClouds(gameSpeed: number, dt: number) {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

    for (const cloud of this.clouds) {
      if (dt > 0) {
        cloud.x -= (cloud.speed + gameSpeed * 0.08) * dt;
        if (cloud.x < -180) {
          cloud.x = CANVAS_WIDTH + Math.random() * 80;
          cloud.y = 35 + Math.random() * 110;
        }
      }

      this.ctx.save();
      this.ctx.translate(cloud.x, cloud.y);
      this.ctx.scale(cloud.scale, cloud.scale);

      this.ctx.beginPath();
      this.ctx.arc(40, 20, 20, 0, Math.PI * 2);
      this.ctx.arc(65, 12, 26, 0, Math.PI * 2);
      this.ctx.arc(95, 18, 22, 0, Math.PI * 2);
      this.ctx.arc(120, 24, 16, 0, Math.PI * 2);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.restore();
    }
    this.ctx.restore();
  }

  // Render Parallax Skyline Buildings
  private renderCity(gameSpeed: number, dt: number, timeColors: ReturnType<typeof this.getTimeColors>, isFrozen: boolean = false) {
    this.ctx.save();
    const citySpeed = gameSpeed * 0.16;

    for (const b of this.cityBuildings) {
      if (dt > 0 && gameSpeed > 0) {
        b.x -= citySpeed * dt;
        if (b.x + b.width < 0) {
          // Wrap around to right
          const maxRight = Math.max(...this.cityBuildings.map((item) => item.x + item.width));
          b.x = maxRight + 10 + Math.random() * 15;
        }
      }

      const by = GROUND_Y - b.height;

      // Building silhouette
      this.ctx.fillStyle = timeColors.cityColor;
      this.ctx.fillRect(b.x, by, b.width, b.height);

      // Skyscraper antenna with red blinking light
      if (b.height > 180) {
        this.ctx.strokeStyle = timeColors.cityColor;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(b.x + b.width / 2, by);
        this.ctx.lineTo(b.x + b.width / 2, by - 24);
        this.ctx.stroke();

        // Blinking beacon (fixed solid if frozen)
        const beaconGlow = isFrozen ? true : Math.sin(Date.now() * 0.006) > 0;
        if (beaconGlow) {
          this.ctx.fillStyle = '#ef4444';
          this.ctx.beginPath();
          this.ctx.arc(b.x + b.width / 2, by - 24, 3, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // Lit Windows at night
      if (timeColors.isNight || timeColors.ambientLight < 0.9) {
        for (const w of b.windows) {
          if (w.lit) {
            this.ctx.fillStyle = '#fef08a';
            this.ctx.fillRect(b.x + w.x, by + w.y, 6, 8);
          }
        }
      }
    }
    this.ctx.restore();
  }

  // Render Midground: Palm Trees & Streetlights
  private renderMidground(gameSpeed: number, dt: number, timeColors: ReturnType<typeof this.getTimeColors>) {
    this.ctx.save();
    const midSpeed = gameSpeed * 0.42;

    // 1. Palm trees
    for (const tree of this.palmTrees) {
      if (dt > 0 && gameSpeed > 0) {
        tree.x -= midSpeed * dt;
        if (tree.x < -80) {
          const maxRight = Math.max(...this.palmTrees.map((item) => item.x));
          tree.x = maxRight + 160 + Math.random() * 200;
        }
      }

      const baseTy = GROUND_Y;
      const trunkTop = baseTy - tree.height;

      // Curved trunk
      this.ctx.strokeStyle = '#422006';
      this.ctx.lineWidth = 7;
      this.ctx.beginPath();
      this.ctx.moveTo(tree.x, baseTy);
      this.ctx.quadraticCurveTo(tree.x + 12, baseTy - tree.height * 0.5, tree.x + 18, trunkTop);
      this.ctx.stroke();

      // Fronds / Palm leaves
      this.ctx.fillStyle = '#15803d';
      for (let angle = 0; angle < Math.PI * 2; angle += 0.8) {
        this.ctx.save();
        this.ctx.translate(tree.x + 18, trunkTop);
        this.ctx.rotate(angle);
        this.ctx.beginPath();
        this.ctx.ellipse(28, 0, 32, 7, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }

    // 2. Overhead Highway Street Lights
    for (const light of this.streetLights) {
      if (dt > 0 && gameSpeed > 0) {
        light.x -= midSpeed * dt;
        if (light.x < -100) {
          const maxRight = Math.max(...this.streetLights.map((item) => item.x));
          light.x = maxRight + 320;
        }
      }

      const poleX = light.x;
      const poleH = 170;
      const lightY = GROUND_Y - poleH;

      // Metallic Pole
      this.ctx.strokeStyle = '#64748b';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(poleX, GROUND_Y);
      this.ctx.lineTo(poleX, lightY + 20);
      this.ctx.quadraticCurveTo(poleX, lightY, poleX + 28, lightY);
      this.ctx.stroke();

      // Lamp housing
      this.ctx.fillStyle = '#334155';
      this.ctx.fillRect(poleX + 22, lightY - 4, 18, 8);

      // Light Cone (glowing on road at night/dusk)
      if (timeColors.ambientLight < 0.95) {
        const coneGrad = this.ctx.createRadialGradient(
          poleX + 31,
          lightY + 4,
          10,
          poleX + 31,
          GROUND_Y,
          160
        );
        coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
        coneGrad.addColorStop(0.7, 'rgba(254, 240, 138, 0.12)');
        coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');

        this.ctx.fillStyle = coneGrad;
        this.ctx.beginPath();
        this.ctx.moveTo(poleX + 24, lightY + 4);
        this.ctx.lineTo(poleX - 60, GROUND_Y);
        this.ctx.lineTo(poleX + 120, GROUND_Y);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  // Render Road, Curbs, and Scrolling Highway Stripes
  private renderHighway(gameSpeed: number, dt: number, timeColors: ReturnType<typeof this.getTimeColors>) {
    this.ctx.save();

    // Road surface
    this.ctx.fillStyle = timeColors.roadColor;
    this.ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // Top Curb shoulder
    const curbHeight = 12;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, GROUND_Y - curbHeight, CANVAS_WIDTH, curbHeight);

    // Alternating red and white curb stones
    if (dt > 0 && gameSpeed > 0) {
      this.roadStripesOffset = (this.roadStripesOffset + gameSpeed * dt) % 60;
    }
    const curbBlockWidth = 30;
    const numCurbBlocks = Math.ceil(CANVAS_WIDTH / curbBlockWidth) + 2;

    for (let i = -1; i < numCurbBlocks; i++) {
      const cx = i * curbBlockWidth - (this.roadStripesOffset % curbBlockWidth);
      const isRed = (Math.floor((i + Math.floor(this.roadStripesOffset / curbBlockWidth)) % 2) + 2) % 2 === 0;
      this.ctx.fillStyle = isRed ? '#ef4444' : '#f8fafc';
      this.ctx.fillRect(cx, GROUND_Y - curbHeight, curbBlockWidth - 2, curbHeight);
    }

    // Yellow Highway Dashed Center Line
    this.ctx.fillStyle = '#eab308';
    this.ctx.shadowColor = '#facc15';
    this.ctx.shadowBlur = 6;
    const stripeWidth = 55;
    const stripeGap = 45;
    const totalStripeUnit = stripeWidth + stripeGap;
    const numStripes = Math.ceil(CANVAS_WIDTH / totalStripeUnit) + 2;

    const laneY = GROUND_Y + 50;
    for (let i = -1; i < numStripes; i++) {
      const sx = i * totalStripeUnit - (this.roadStripesOffset * 1.5 % totalStripeUnit);
      this.ctx.fillRect(sx, laneY, stripeWidth, 8);
    }

    // Bottom road border line
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#475569';
    this.ctx.fillRect(0, CANVAS_HEIGHT - 6, CANVAS_WIDTH, 6);

    this.ctx.restore();
  }

  // Render Collectible 50m Diamonds (floating and shining)
  private renderDiamonds(diamonds: CollectibleDiamond[]) {
    this.ctx.save();

    for (const d of diamonds) {
      if (d.collected) continue;

      const dy = d.y;
      const size = d.size;

      this.ctx.save();
      this.ctx.translate(d.x, dy);

      // Outer Pulsating Halo
      const pulse = 1 + 0.15 * Math.sin(d.bobPhase * 4);
      const haloGrad = this.ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.6 * pulse);
      haloGrad.addColorStop(0, 'rgba(0, 240, 255, 0.7)');
      haloGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.25)');
      haloGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      this.ctx.fillStyle = haloGrad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size * 1.6 * pulse, 0, Math.PI * 2);
      this.ctx.fill();

      // Rotating Gem Shimmer
      this.ctx.rotate(Math.sin(d.bobPhase * 2) * 0.08);

      // Draw Brilliant Faceted Diamond
      const r = size * 0.85;
      const topY = -r;
      const botY = r * 1.15;
      const midY = -r * 0.15;
      const leftX = -r;
      const rightX = r;
      const innerLX = -r * 0.45;
      const innerRX = r * 0.45;

      // Top Crown Facet
      this.ctx.fillStyle = '#cffafe';
      this.ctx.beginPath();
      this.ctx.moveTo(0, topY);
      this.ctx.lineTo(innerRX, midY);
      this.ctx.lineTo(innerLX, midY);
      this.ctx.closePath();
      this.ctx.fill();

      // Top Left Corner Facet
      this.ctx.fillStyle = '#7dd3fc';
      this.ctx.beginPath();
      this.ctx.moveTo(0, topY);
      this.ctx.lineTo(innerLX, midY);
      this.ctx.lineTo(leftX, midY);
      this.ctx.closePath();
      this.ctx.fill();

      // Top Right Corner Facet
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.beginPath();
      this.ctx.moveTo(0, topY);
      this.ctx.lineTo(rightX, midY);
      this.ctx.lineTo(innerRX, midY);
      this.ctx.closePath();
      this.ctx.fill();

      // Bottom Center Pavilion Facet
      this.ctx.fillStyle = '#0284c7';
      this.ctx.beginPath();
      this.ctx.moveTo(innerLX, midY);
      this.ctx.lineTo(innerRX, midY);
      this.ctx.lineTo(0, botY);
      this.ctx.closePath();
      this.ctx.fill();

      // Bottom Left Pavilion Facet
      this.ctx.fillStyle = '#0369a1';
      this.ctx.beginPath();
      this.ctx.moveTo(leftX, midY);
      this.ctx.lineTo(innerLX, midY);
      this.ctx.lineTo(0, botY);
      this.ctx.closePath();
      this.ctx.fill();

      // Bottom Right Pavilion Facet
      this.ctx.fillStyle = '#0ea5e9';
      this.ctx.beginPath();
      this.ctx.moveTo(rightX, midY);
      this.ctx.lineTo(innerRX, midY);
      this.ctx.lineTo(0, botY);
      this.ctx.closePath();
      this.ctx.fill();

      // Diamond Outline
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, topY);
      this.ctx.lineTo(rightX, midY);
      this.ctx.lineTo(0, botY);
      this.ctx.lineTo(leftX, midY);
      this.ctx.closePath();
      this.ctx.stroke();

      // Bright Sparkle Glint
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(innerLX * 0.4, topY + 4, 3, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  // Render Police Patrol Cars (with flashing red & blue emergency strobes)
  private renderPoliceCars(policeCars: PoliceCar[], dt: number) {
    this.ctx.save();

    for (const car of policeCars) {
      if (dt > 0) {
        car.sirenPhase = (car.sirenPhase + dt * 9) % (Math.PI * 2);
      }
      const isRedActive = Math.sin(car.sirenPhase) > 0;

      const cx = car.x;
      const cy = car.y;
      const cw = car.width;
      const ch = car.height;

      this.ctx.save();

      // 1. Shadow underneath car
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.ctx.beginPath();
      this.ctx.ellipse(cx + cw / 2, cy + ch + 2, cw * 0.52, 6, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // 2. Car Chassis / Lower Body
      // Pure White base
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.beginPath();
      this.ctx.roundRect(cx, cy + 18, cw, ch - 22, [6, 12, 4, 4]);
      this.ctx.fill();
      this.ctx.strokeStyle = '#cbd5e1';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Navy Blue Doors & Side Panels
      this.ctx.fillStyle = '#0f172a';
      this.ctx.fillRect(cx + 26, cy + 19, cw * 0.48, ch - 24);

      // Gold Police Badge Emblem
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.beginPath();
      this.ctx.arc(cx + 42, cy + 29, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#0284c7';
      this.ctx.beginPath();
      this.ctx.arc(cx + 42, cy + 29, 3, 0, Math.PI * 2);
      this.ctx.fill();

      // Bold "POLICE" Text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 9px Orbitron, Outfit, sans-serif';
      this.ctx.fillText('POLICE', cx + 52, cy + 32);

      // 3. Cabin / Roof / Windows
      this.ctx.fillStyle = '#0284c7'; // Tinted windshield
      this.ctx.beginPath();
      this.ctx.moveTo(cx + 18, cy + 18);
      this.ctx.lineTo(cx + 34, cy + 3);
      this.ctx.lineTo(cx + cw - 32, cy + 3);
      this.ctx.lineTo(cx + cw - 12, cy + 18);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = '#0369a1';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Window divider pillars
      this.ctx.fillStyle = '#1e293b';
      this.ctx.fillRect(cx + 52, cy + 4, 5, 14);

      // Windshield glint
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(cx + 26, cy + 16);
      this.ctx.lineTo(cx + 36, cy + 6);
      this.ctx.stroke();

      // 4. Heavy Push-Bumper (Bullbar on front left)
      this.ctx.fillStyle = '#1e293b';
      this.ctx.fillRect(cx - 4, cy + 22, 6, 20);
      this.ctx.fillStyle = '#475569';
      this.ctx.fillRect(cx - 2, cy + 24, 4, 16);

      // 5. Headlight Beam (casting forward)
      this.ctx.fillStyle = '#fef08a';
      this.ctx.fillRect(cx, cy + 24, 5, 8);

      // Headlight Beam Cone
      const beamGrad = this.ctx.createLinearGradient(cx, cy + 28, cx - 120, cy + 35);
      beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.5)');
      beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      this.ctx.fillStyle = beamGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy + 24);
      this.ctx.lineTo(cx - 120, cy + 10);
      this.ctx.lineTo(cx - 120, cy + 50);
      this.ctx.lineTo(cx, cy + 32);
      this.ctx.closePath();
      this.ctx.fill();

      // Tail lights on right
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fillRect(cx + cw - 4, cy + 24, 4, 8);

      // 6. Realistic Mag Wheels (spinning with road)
      const wheelRadius = 14;
      const frontWheelX = cx + 24;
      const backWheelX = cx + cw - 26;
      const wheelY = cy + ch - 4;

      for (const wx of [frontWheelX, backWheelX]) {
        // Black tire rubber
        this.ctx.fillStyle = '#0f172a';
        this.ctx.beginPath();
        this.ctx.arc(wx, wheelY, wheelRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Silver Alloy Rim
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.beginPath();
        this.ctx.arc(wx, wheelY, wheelRadius * 0.6, 0, Math.PI * 2);
        this.ctx.fill();

        // Spokes spinning smoothly with active car motion
        const wheelAngle = car.wheelRotation !== undefined ? car.wheelRotation : (car.x * 0.1) % (Math.PI * 2);
        this.ctx.save();
        this.ctx.translate(wx, wheelY);
        this.ctx.rotate(wheelAngle);
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 2;
        for (let sp = 0; sp < 4; sp++) {
          this.ctx.beginPath();
          this.ctx.moveTo(-wheelRadius * 0.55, 0);
          this.ctx.lineTo(wheelRadius * 0.55, 0);
          this.ctx.stroke();
          this.ctx.rotate(Math.PI / 4);
        }
        this.ctx.restore();
      }

      // 7. Roof LED Lightbar (Flashing Red and Blue)
      const lightbarX = cx + 46;
      const lightbarY = cy - 3;
      const lightbarW = 34;
      const lightbarH = 7;

      // Base mount
      this.ctx.fillStyle = '#334155';
      this.ctx.fillRect(lightbarX - 2, lightbarY + 4, lightbarW + 4, 3);

      // Red LED section
      this.ctx.fillStyle = isRedActive ? '#ef4444' : '#7f1d1d';
      this.ctx.fillRect(lightbarX, lightbarY, lightbarW * 0.48, lightbarH);

      // Center clear lens
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.fillRect(lightbarX + lightbarW * 0.46, lightbarY, 3, lightbarH);

      // Blue LED section
      this.ctx.fillStyle = !isRedActive ? '#3b82f6' : '#1e3a8a';
      this.ctx.fillRect(lightbarX + lightbarW * 0.52, lightbarY, lightbarW * 0.48, lightbarH);

      // High Intensity Strobe Glow
      const strobeColor = isRedActive ? '#ef4444' : '#3b82f6';
      const strobeGrad = this.ctx.createRadialGradient(
        lightbarX + lightbarW / 2,
        lightbarY + 3,
        4,
        lightbarX + lightbarW / 2,
        lightbarY + 3,
        50
      );
      strobeGrad.addColorStop(0, strobeColor);
      strobeGrad.addColorStop(0.3, isRedActive ? 'rgba(239, 68, 68, 0.45)' : 'rgba(59, 130, 246, 0.45)');
      strobeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = strobeGrad;
      this.ctx.beginPath();
      this.ctx.arc(lightbarX + lightbarW / 2, lightbarY + 3, 50, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  // Render the Hero Boy Player (TTF Vasan with exact uploaded face and anatomically correct kinematics)
  private renderBoy(boy: BoyPlayer, isCollided: boolean, timeColors?: ReturnType<typeof this.getTimeColors>) {
    this.ctx.save();

    const bx = boy.x;
    const by = boy.y;
    const bw = boy.width;
    const bh = boy.height;

    this.ctx.translate(bx + bw / 2, by + bh / 2);

    // Collision tumble rotation
    if (isCollided) {
      this.ctx.rotate(boy.rotation);
    }

    const isGrounded = boy.isGrounded;
    const isIdle = isGrounded && boy.runCycle === 0 && !boy.isJumping && boy.vy === 0;
    const stride = isGrounded && !isIdle ? boy.runCycle : 0;
    const runBounce = isGrounded && !isIdle ? Math.abs(Math.sin(stride)) * 2.8 : 0;
    
    // Landing shock absorption cushion (dips knees & torso to absorb asphalt contact)
    const landingBounce = (boy.landingTimer && boy.landingTimer > 0)
      ? Math.sin((boy.landingTimer / 0.14) * Math.PI) * 4.0
      : 0;

    // Subtle idle breathing movement
    const idleBreath = isIdle ? Math.sin(Date.now() * 0.003) * 0.8 : 0;
    const bounce = runBounce + landingBounce + idleBreath;
    const vNorm = isGrounded ? 0 : Math.max(-1, Math.min(1, boy.vy / 650));

    // Dynamic forward athletic lean: 10-15 degrees when running (~0.20 rad), 0 in idle
    let torsoLean = 0;
    if (isIdle) {
      torsoLean = 0;
    } else if (isGrounded) {
      torsoLean = 0.20 + Math.sin(stride * 2) * 0.02; // 11.5° to 12.6° running lean
    } else {
      torsoLean = 0.14; // Airborne lean
    }

    // 0. Sneaker Ground Shadow
    if (isGrounded && !isCollided) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.beginPath();
      this.ctx.ellipse(0, bh / 2 + 1, 20, 4.5, 0, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (!isGrounded && !isCollided) {
      const altitude = Math.max(0, -by + (GROUND_Y - bh));
      const shadowScale = Math.max(0.4, 1 - altitude / 180);
      const shadowAlpha = Math.max(0.1, 0.35 * shadowScale);
      this.ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      this.ctx.beginPath();
      this.ctx.ellipse(0, bh / 2 + altitude + 1, 20 * shadowScale, 4.5 * shadowScale, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Kinematic Hip & Limb Geometry (Legs are ~50% of total body height)
    const hipY = 2 - bounce;
    const leftHipX = -4;
    const rightHipX = 4;

    // Kinematic Joint Angle Calculations
    let thighAngleLeft: number, kneeBendLeft: number;
    let thighAngleRight: number, kneeBendRight: number;
    let leftArmAngle: number, leftElbowBend: number;
    let rightUpperArmAngle: number, rightForearmAngle: number;

    if (isIdle) {
      // RELAXED STANDING IDLE POSE
      thighAngleLeft = -0.04;
      kneeBendLeft = 0.18;
      thighAngleRight = 0.04;
      kneeBendRight = 0.18;

      // Arms relaxed, right hand holding diamond at chest
      leftArmAngle = 0.08;
      leftElbowBend = 0.28;
      rightUpperArmAngle = -0.28;
      rightForearmAngle = -1.35;
    } else if (isGrounded) {
      // NATURAL RUNNING GAIT
      // Opposite arm and leg swing (left arm forward with right leg forward)
      const phaseRight = stride;
      thighAngleRight = Math.sin(phaseRight) * 0.52; // ±30°
      kneeBendRight = 0.22 + 0.85 * Math.max(0, Math.sin(phaseRight)) + 0.25 * (1 - Math.cos(phaseRight)) / 2;

      const phaseLeft = stride + Math.PI;
      thighAngleLeft = Math.sin(phaseLeft) * 0.52; // Opposes front leg by 180°
      kneeBendLeft = 0.22 + 0.85 * Math.max(0, Math.sin(phaseLeft)) + 0.25 * (1 - Math.cos(phaseLeft)) / 2;

      // Landing shock absorption cushion
      if (landingBounce > 0) {
        const landFlex = (landingBounce / 4.0) * 0.35;
        kneeBendRight += landFlex;
        kneeBendLeft += landFlex;
      }

      // Back arm (left arm) swings forward with right leg, elbow bent ~90°
      leftArmAngle = Math.sin(stride) * 0.55; // Left arm swings forward when right leg swings forward
      leftElbowBend = 1.50 + Math.cos(stride) * 0.15; // Sprinter 90° elbow flexion

      // Front arm (right arm) held steady forward holding the diamond
      rightUpperArmAngle = -0.38 + Math.sin(stride) * 0.05;
      rightForearmAngle = -1.48 + Math.sin(stride) * 0.04;
    } else {
      // 4-PHASE PARKOUR JUMPING SEQUENCE
      if (vNorm < -0.3) {
        // Phase 1: Take-off Crouch & Rapid Ascent
        // Front knee tucks high to clear police cars; back leg trails naturally
        const t = (-vNorm - 0.3) / 0.7; // 0 (near apex) to 1 (launch)
        thighAngleRight = 0.52 + t * 0.18; // 30° to 40° forward tuck
        kneeBendRight = 0.90 + t * 0.30;   // 51° to 69° backward flexion
        thighAngleLeft = -0.22 - t * 0.16; // -13° to -22° trailing
        kneeBendLeft = 0.95 + t * 0.20;    // 54° to 66° backward flexion
        torsoLean = 0.16 + t * 0.05;

        leftArmAngle = 0.35 + t * 0.20; // Arms swing up on takeoff
        leftElbowBend = 1.40;
        rightUpperArmAngle = -0.52 - t * 0.12;
        rightForearmAngle = -1.55;
      } else if (vNorm <= 0.3) {
        // Phase 2: Airborne / Apex Peak
        // Stable, heroic mid-air pose: limbs balanced, diamond held proudly
        const t = (vNorm + 0.3) / 0.6; // 0 to 1 across apex
        thighAngleRight = 0.52 - t * 0.14;
        kneeBendRight = 0.90 - t * 0.25;
        thighAngleLeft = -0.22 + t * 0.14;
        kneeBendLeft = 0.95 - t * 0.25;
        torsoLean = 0.14;

        leftArmAngle = 0.25 - t * 0.10;
        leftElbowBend = 1.35;
        rightUpperArmAngle = -0.48;
        rightForearmAngle = -1.50;
      } else {
        // Phase 3: Descent & Touchdown Preparation
        // Feet extend toward the ground, knees softened (18°-22°) to prepare for contact
        const t = (vNorm - 0.3) / 0.7; // 0 to 1
        thighAngleRight = 0.38 - t * 0.24; // Straightening to near vertical
        kneeBendRight = 0.65 - t * 0.35;   // Softening to 0.30 rad (17°)
        thighAngleLeft = -0.08 + t * 0.04;
        kneeBendLeft = 0.70 - t * 0.35;    // Softening to 0.35 rad (20°)
        torsoLean = 0.14 - t * 0.04;

        leftArmAngle = 0.12 - t * 0.10;
        leftElbowBend = 1.20;
        rightUpperArmAngle = -0.40;
        rightForearmAngle = -1.45;
      }
    }

    // Helper: Draw Pants Leg with proper thighs, shins, and sneakers
    const drawLeg = (hipX: number, hipY: number, thighAngle: number, kneeBend: number, isFront: boolean) => {
      const thighLen = 20;
      const shinLen = 19;

      const kneeX = hipX + Math.sin(thighAngle) * thighLen;
      const kneeY = hipY + Math.cos(thighAngle) * thighLen;

      // Knee flexion is strictly backward (kneeBend > 0 at all times)
      const shinAngle = thighAngle - Math.max(0.15, kneeBend);
      const ankleX = kneeX + Math.sin(shinAngle) * shinLen;
      const ankleY = kneeY + Math.cos(shinAngle) * shinLen;

      // Thigh (black pants)
      this.ctx.strokeStyle = isFront ? '#27272a' : '#18181b';
      this.ctx.lineWidth = 8;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(hipX, hipY);
      this.ctx.lineTo(kneeX, kneeY);
      this.ctx.stroke();

      // Yellow athletic seam piping on cargo pants
      if (isFront) {
        this.ctx.strokeStyle = '#facc15';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(hipX + 2, hipY);
        this.ctx.lineTo(kneeX + 2, kneeY);
        this.ctx.stroke();
      }

      // Knee joint cap
      this.ctx.fillStyle = isFront ? '#3f3f46' : '#27272a';
      this.ctx.beginPath();
      this.ctx.arc(kneeX, kneeY, 4, 0, Math.PI * 2);
      this.ctx.fill();

      // Lower leg / Shin (black pants)
      this.ctx.strokeStyle = isFront ? '#27272a' : '#18181b';
      this.ctx.lineWidth = 7;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(kneeX, kneeY);
      this.ctx.lineTo(ankleX, ankleY);
      this.ctx.stroke();

      if (isFront) {
        this.ctx.strokeStyle = '#facc15';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(kneeX + 2, kneeY);
        this.ctx.lineTo(ankleX + 2, ankleY);
        this.ctx.stroke();
      }

      // Sneaker
      const footAngle = isGrounded
        ? (ankleY >= 40 ? 0 : Math.max(-0.25, Math.min(0.35, shinAngle * 0.5)))
        : Math.max(-0.2, Math.min(0.35, shinAngle * 0.5));

      this.ctx.save();
      this.ctx.translate(ankleX, ankleY);
      this.ctx.rotate(footAngle);

      // Sneaker upper (both shoes matching athletic electric cyan)
      this.ctx.fillStyle = '#06b6d4';
      this.ctx.beginPath();
      this.ctx.roundRect(-4, 0, 15, 6, [2, 4, 2, 2]);
      this.ctx.fill();

      // Crisp white runner sole
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.fillRect(-5, 4.5, 16, 2.5);
      this.ctx.restore();
    };

    // =========================================================================
    // EXACT SPECIFIED RENDER ORDER:
    // back arm > legs > torso > head/face > front arm
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. BACK ARM (Left Arm: yellow sleeve, skin forearm, relaxed fist)
    // -------------------------------------------------------------------------
    this.ctx.save();
    this.ctx.translate(0, hipY);
    this.ctx.rotate(torsoLean);

    const leftShoulderX = -9;
    const leftShoulderY = -20;
    const upperArmLen = 13;
    const forearmLen = 12;

    const leftElbowX = leftShoulderX + Math.sin(leftArmAngle) * upperArmLen;
    const leftElbowY = leftShoulderY + Math.cos(leftArmAngle) * upperArmLen;
    const leftForearmAngle = leftArmAngle - leftElbowBend;
    const leftWristX = leftElbowX + Math.sin(leftForearmAngle) * forearmLen;
    const leftWristY = leftElbowY + Math.cos(leftForearmAngle) * forearmLen;

    // Upper arm sleeve (yellow shirt)
    this.ctx.strokeStyle = '#eab308';
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(leftShoulderX, leftShoulderY);
    this.ctx.lineTo(leftElbowX, leftElbowY);
    this.ctx.stroke();

    // Forearm & fist (skin tone)
    this.ctx.strokeStyle = '#b37a4c';
    this.ctx.lineWidth = 4.5;
    this.ctx.beginPath();
    this.ctx.moveTo(leftElbowX, leftElbowY);
    this.ctx.lineTo(leftWristX, leftWristY);
    this.ctx.stroke();

    this.ctx.fillStyle = '#b37a4c';
    this.ctx.beginPath();
    this.ctx.arc(leftWristX, leftWristY, 3, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();

    // -------------------------------------------------------------------------
    // 2. LEGS (Both pants legs: thighs, shins, sneakers)
    // -------------------------------------------------------------------------
    // Back leg (Left Leg)
    drawLeg(leftHipX, hipY, thighAngleLeft, kneeBendLeft, false);
    // Front leg (Right Leg)
    drawLeg(rightHipX, hipY, thighAngleRight, kneeBendRight, true);

    // -------------------------------------------------------------------------
    // 3. TORSO (Single clean shirt - drapes naturally over pants waist)
    // -------------------------------------------------------------------------
    this.ctx.save();
    this.ctx.translate(0, hipY);
    this.ctx.rotate(torsoLean);

    // Contoured athletic torso: shoulders wider than hips (W=20 at top, W=14 at waist)
    // One single unified shirt shape: NO duplicate layers, NO ghost body, NO cloth tails!
    this.ctx.fillStyle = '#facc15';
    this.ctx.beginPath();
    this.ctx.moveTo(-10, -21); // Left shoulder
    this.ctx.lineTo(10, -21);  // Right shoulder
    this.ctx.lineTo(7, 1);     // Right waist (overlaps pants waistband)
    this.ctx.lineTo(-7, 1);    // Left waist
    this.ctx.closePath();
    this.ctx.fill();

    // Contoured athletic black side panels
    this.ctx.fillStyle = '#18181b';
    this.ctx.beginPath();
    this.ctx.moveTo(-10, -21);
    this.ctx.lineTo(-5, -21);
    this.ctx.lineTo(-4, 1);
    this.ctx.lineTo(-7, 1);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(10, -21);
    this.ctx.lineTo(5, -21);
    this.ctx.lineTo(4, 1);
    this.ctx.lineTo(7, 1);
    this.ctx.closePath();
    this.ctx.fill();

    // Dark collar band at top of shirt
    this.ctx.fillRect(-7, -22, 14, 2.5);

    // Cyan center zipper
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 1.8;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -20);
    this.ctx.lineTo(0, 1);
    this.ctx.stroke();

    // Silver biker chain
    this.ctx.strokeStyle = '#e2e8f0';
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.arc(0, -21, 4.5, 0.2, Math.PI - 0.2);
    this.ctx.stroke();

    // -------------------------------------------------------------------------
    // 4. HEAD / FACE (Contoured neck, authentic face image anchored just above collar)
    // -------------------------------------------------------------------------
    // Athletic visible neck connecting collar at y = -20 up behind chin to y = -25
    this.ctx.fillStyle = '#b37a4c';
    this.ctx.beginPath();
    this.ctx.roundRect(-3.5, -25, 7, 6, [2, 2, 0, 0]);
    this.ctx.fill();

    this.ctx.strokeStyle = '#9a5f36';
    this.ctx.lineWidth = 0.8;
    this.ctx.beginPath();
    this.ctx.moveTo(-1, -24);
    this.ctx.lineTo(-1, -21);
    this.ctx.stroke();

    // Authentic TTF Vasan face (scaled to natural ~1/5.5 proportion: 27.7px W x 25px H)
    // Chin is at 59.2% width in asset -> headX = -headWidth * 0.592 centers face on neck at x=0
    // Chin sits at y = -22 (JUST ABOVE COLLAR at y = -20)
    this.ctx.save();
    if (this.faceLoaded && this.faceSprite) {
      const headHeight = 25;
      const headWidth = Math.round(headHeight * (982 / 888) * 10) / 10; // 27.7px
      const headX = -headWidth * 0.592; // -16.4px, horizontally centers chin at x=0
      const headY = -22 - headHeight;   // -47px, top of hair at -47, chin resting just above collar at -22

      this.ctx.save();
      if (timeColors && timeColors.ambientLight < 0.85) {
        this.ctx.filter = `brightness(${Math.max(0.72, timeColors.ambientLight)}) contrast(1.05)`;
      }

      this.ctx.drawImage(this.faceSprite, headX, headY, headWidth, headHeight);
      this.ctx.restore();
    } else {
      this.ctx.fillStyle = '#c68b59';
      this.ctx.beginPath();
      this.ctx.arc(0, -37, 10, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();

    // -------------------------------------------------------------------------
    // 5. FRONT ARM (Right Arm holding Glowing Diamond in Rider Glove)
    // -------------------------------------------------------------------------
    const rightShoulderX = 9;
    const rightShoulderY = -20;

    const elbowX = rightShoulderX + Math.cos(rightUpperArmAngle) * upperArmLen;
    const elbowY = rightShoulderY + Math.sin(rightUpperArmAngle) * upperArmLen;
    const wristX = elbowX + Math.cos(rightForearmAngle) * forearmLen;
    const wristY = elbowY + Math.sin(rightForearmAngle) * forearmLen;

    // Upper arm sleeve (yellow shirt)
    this.ctx.strokeStyle = '#facc15';
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(rightShoulderX, rightShoulderY);
    this.ctx.lineTo(elbowX, elbowY);
    this.ctx.stroke();

    // Forearm (skin tone)
    this.ctx.strokeStyle = '#b37a4c';
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.moveTo(elbowX, elbowY);
    this.ctx.lineTo(wristX, wristY);
    this.ctx.stroke();

    // Fingerless rider glove palm at wrist
    this.ctx.fillStyle = '#18181b';
    this.ctx.beginPath();
    this.ctx.arc(wristX, wristY, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // --- THE GLOWING CYAN DIAMOND FIRMLY HELD IN HAND ---
    // Diamond pavilion tip is locked directly in the glove palm!
    const diamTipX = wristX + 1;
    const diamTipY = wristY - 2;
    const diamX = diamTipX;
    const diamY = diamTipY - 9;
    const diamPulse = 1 + 0.16 * Math.sin(Date.now() * 0.008);

    // Cyan Radiant Glow Halo
    const gemHalo = this.ctx.createRadialGradient(diamX, diamY, 2, diamX, diamY, 22 * diamPulse);
    gemHalo.addColorStop(0, 'rgba(0, 240, 255, 0.85)');
    gemHalo.addColorStop(0.4, 'rgba(56, 189, 248, 0.4)');
    gemHalo.addColorStop(1, 'rgba(0, 240, 255, 0)');
    this.ctx.fillStyle = gemHalo;
    this.ctx.beginPath();
    this.ctx.arc(diamX, diamY, 22 * diamPulse, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw Faceted Diamond
    const gr = 9;
    this.ctx.save();
    this.ctx.translate(diamX, diamY);

    // Top Crown
    this.ctx.fillStyle = '#e0f2fe';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -gr);
    this.ctx.lineTo(gr * 0.5, -gr * 0.2);
    this.ctx.lineTo(-gr * 0.5, -gr * 0.2);
    this.ctx.closePath();
    this.ctx.fill();

    // Left Facet
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -gr);
    this.ctx.lineTo(-gr, -gr * 0.2);
    this.ctx.lineTo(-gr * 0.5, -gr * 0.2);
    this.ctx.closePath();
    this.ctx.fill();

    // Right Facet
    this.ctx.fillStyle = '#0284c7';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -gr);
    this.ctx.lineTo(gr, -gr * 0.2);
    this.ctx.lineTo(gr * 0.5, -gr * 0.2);
    this.ctx.closePath();
    this.ctx.fill();

    // Bottom Pavilion Point (meeting the hand)
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.beginPath();
    this.ctx.moveTo(-gr, -gr * 0.2);
    this.ctx.lineTo(gr, -gr * 0.2);
    this.ctx.lineTo(0, gr);
    this.ctx.closePath();
    this.ctx.fill();

    // Diamond Outline & Sparkle
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.1;
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(-2, -gr * 0.5, 1.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();

    // Glove Fingers curled around the lower edge of the diamond
    this.ctx.fillStyle = '#b37a4c';
    this.ctx.beginPath();
    this.ctx.arc(wristX + 3.2, wristY - 3.5, 2.2, 0, Math.PI * 2);
    this.ctx.arc(wristX + 1.2, wristY - 5.5, 2.0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#18181b';
    this.ctx.lineWidth = 0.9;
    this.ctx.stroke();

    this.ctx.restore(); // End Upper Body FK Chain

    this.ctx.restore();
  }

  // Render particles (dust, sparkles, explosions)
  private renderParticles(particles: Particle[]) {
    this.ctx.save();
    for (const p of particles) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;

      if (p.shape === 'sparkle') {
        this.ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) this.ctx.rotate(p.rotation);
        const s = p.size;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -s);
        this.ctx.lineTo(s * 0.3, -s * 0.3);
        this.ctx.lineTo(s, 0);
        this.ctx.lineTo(s * 0.3, s * 0.3);
        this.ctx.lineTo(0, s);
        this.ctx.lineTo(-s * 0.3, s * 0.3);
        this.ctx.lineTo(-s, 0);
        this.ctx.lineTo(-s * 0.3, -s * 0.3);
        this.ctx.closePath();
        this.ctx.fill();
      } else if (p.shape === 'shard') {
        this.ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) this.ctx.rotate(p.rotation);
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        // Circle (smoke dust)
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }
    this.ctx.restore();
  }

  // Dynamic siren screen edge flash when a police car is actively on screen
  private renderSirenScreenGlow(policeCars: PoliceCar[]) {
    const nearbyCar = policeCars.find((car) => car.x > 0 && car.x < CANVAS_WIDTH + 80);
    if (!nearbyCar) return;

    const isRed = Math.sin(nearbyCar.sirenPhase) > 0;
    const alpha = 0.08 + Math.abs(Math.sin(nearbyCar.sirenPhase)) * 0.08;

    this.ctx.save();
    const glowGrad = this.ctx.createLinearGradient(0, 0, 0, 50);
    glowGrad.addColorStop(0, isRed ? `rgba(239, 68, 68, ${alpha})` : `rgba(59, 130, 246, ${alpha})`);
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = glowGrad;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
    this.ctx.restore();
  }
}
