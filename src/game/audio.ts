// Centralized Audio Manager for TTF RUN 💎
// Handles external SFX assets (Jump, End) with audio pooling, preloading,
// autoplay unlocking, error handling, volume control, and synthesized sound effects.

export interface AudioVolumes {
  jump: number;
  end: number;
}

const AUDIO_CONFIG = {
  jumpUrl: '/assets/audio/Jump.mp3',
  endUrl: '/assets/audio/End.mp3',
  jumpVolume: 0.6,
  endVolume: 0.8,
  jumpPoolSize: 6,
};

class SoundSystem {
  // Web Audio Context for synthesized effects & background pulse
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isPaused: boolean = false;
  private bgmGain: GainNode | null = null;
  private isBgmPlaying: boolean = false;
  private bgmTimer: number | null = null;
  private tempo: number = 124; // BPM for runner rhythm

  // Centralized volume configuration
  private volumes: AudioVolumes = {
    jump: AUDIO_CONFIG.jumpVolume,
    end: AUDIO_CONFIG.endVolume,
  };

  // SFX Audio Elements
  private jumpPool: HTMLAudioElement[] = [];
  private jumpPoolIndex: number = 0;
  private endAudio: HTMLAudioElement | null = null;
  private gameOverSoundPlayed: boolean = false;
  private isUnlocked: boolean = false;

  constructor() {
    const savedMute = typeof localStorage !== 'undefined' ? localStorage.getItem('ttf_run_muted') : null;
    this.isMuted = savedMute === 'true';

    // Preload audio files immediately so there is no delay on first play
    this.preloadAudio();

    // Listen for the first user interaction to unlock browser autoplay
    this.setupAutoplayUnlock();
  }

  // Preload audio elements
  private preloadAudio() {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    try {
      const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
      const jumpSrc = `${baseUrl}${AUDIO_CONFIG.jumpUrl}`;
      const endSrc = `${baseUrl}${AUDIO_CONFIG.endUrl}`;

      // Create separate audio instances for Jump to allow rapid overlap/restarts
      this.jumpPool = [];
      for (let i = 0; i < AUDIO_CONFIG.jumpPoolSize; i++) {
        const audio = new Audio(jumpSrc);
        audio.preload = 'auto';
        audio.volume = this.volumes.jump;
        audio.muted = this.isMuted;
        try {
          audio.load();
        } catch (_) {}
        this.jumpPool.push(audio);
      }

      // Preload End sound
      this.endAudio = new Audio(endSrc);
      this.endAudio.preload = 'auto';
      this.endAudio.volume = this.volumes.end;
      this.endAudio.muted = this.isMuted;
      try {
        this.endAudio.load();
      } catch (_) {}
    } catch (err) {
      console.warn('Audio preloading encountered an error:', err);
    }
  }

  // Handle browser autoplay policy by unlocking on first user interaction
  private setupAutoplayUnlock() {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlockAudio();
      ['click', 'touchstart', 'keydown'].forEach((evt) => {
        window.removeEventListener(evt, unlockHandler, true);
      });
    };

    ['click', 'touchstart', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { capture: true, once: true });
    });
  }

  // Initialize and unlock AudioContext & HTMLAudioElement instances
  public init() {
    this.unlockAudio();
  }

  public unlockAudio() {
    if (this.isUnlocked) return;
    this.isUnlocked = true;

    // Unlock Web Audio Context
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (_) {}

    // Prime audio elements
    this.jumpPool.forEach((audio) => {
      try {
        audio.load();
      } catch (_) {}
    });
    if (this.endAudio) {
      try {
        this.endAudio.load();
      } catch (_) {}
    }
  }

  // ===================== MUTE & PAUSE CONTROLS =====================

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('ttf_run_muted', String(muted));
    } catch (_) {}

    // Synchronize mute state across all audio elements
    this.jumpPool.forEach((audio) => {
      audio.muted = muted;
    });
    if (this.endAudio) {
      this.endAudio.muted = muted;
    }

    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(muted ? 0 : 0.12, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.stopJumpSounds();
      if (this.endAudio && !this.endAudio.paused) {
        try {
          this.endAudio.pause();
        } catch (_) {}
      }
    }
  }

  public getPaused(): boolean {
    return this.isPaused;
  }

  // Volume getters and setters (easy to change in one place)
  public getVolumes(): AudioVolumes {
    return { ...this.volumes };
  }

  public setJumpVolume(volume: number) {
    this.volumes.jump = Math.max(0, Math.min(1, volume));
    this.jumpPool.forEach((audio) => {
      audio.volume = this.volumes.jump;
    });
  }

  public setEndVolume(volume: number) {
    this.volumes.end = Math.max(0, Math.min(1, volume));
    if (this.endAudio) {
      this.endAudio.volume = this.volumes.end;
    }
  }

  // ===================== REQUIRED SFX: JUMP & END =====================

  /**
   * 1. JUMP SOUND
   * - Plays exactly once at the moment the player starts a jump (takeoff frame).
   * - Does not play while running, landing, falling, idle, muted, paused, or during game over.
   * - Uses a pool of separate audio instances so rapid jumps restart cleanly from the beginning without delay or cutoff.
   */
  public playJump() {
    if (this.isMuted || this.isPaused || this.gameOverSoundPlayed) return;
    this.unlockAudio();

    if (this.jumpPool.length === 0) return;

    try {
      // Pick next instance in round-robin pool to allow clean overlapping
      const audio = this.jumpPool[this.jumpPoolIndex];
      this.jumpPoolIndex = (this.jumpPoolIndex + 1) % this.jumpPool.length;

      // Rewind to 0 to ensure immediate playback from beginning
      audio.currentTime = 0;
      audio.volume = this.volumes.jump;
      audio.muted = this.isMuted;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((_err) => {
          // Autoplay or interruption gracefully handled
        });
      }
    } catch (err) {
      console.warn('Error playing Jump SFX:', err);
    }
  }

  /**
   * 2. END SOUND
   * - Plays exactly once at the moment the player crashes / dies / game over state begins.
   * - Guarded by gameOverSoundPlayed flag so it cannot trigger repeatedly in subsequent frames.
   * - Stops and prevents any Jump sounds during game over.
   */
  public playEnd() {
    if (this.isMuted || this.gameOverSoundPlayed) return;
    this.gameOverSoundPlayed = true;
    this.unlockAudio();

    // Stop and prevent any Jump sounds
    this.stopJumpSounds();

    if (!this.endAudio) return;

    try {
      this.endAudio.currentTime = 0;
      this.endAudio.volume = this.volumes.end;
      this.endAudio.muted = this.isMuted;

      const playPromise = this.endAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((_err) => {
          console.warn('Error playing End SFX:', _err);
        });
      }
    } catch (err) {
      console.warn('Error playing End SFX:', err);
    }
  }

  // Alias for backward compatibility with collision crash trigger
  public playCrash() {
    this.playEnd();
  }

  // Alias for game over trigger
  public playGameOver() {
    this.playEnd();
  }

  // Stop any active Jump sounds
  public stopJumpSounds() {
    this.jumpPool.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
    });
  }

  /**
   * Resets the gameOverSoundPlayed flag when the game restarts
   * so the End sound will play again in the next round.
   */
  public resetEndSound() {
    this.gameOverSoundPlayed = false;
    if (this.endAudio) {
      try {
        this.endAudio.pause();
        this.endAudio.currentTime = 0;
      } catch (_) {}
    }
  }

  public resetGameOverSound() {
    this.resetEndSound();
  }

  // ===================== OTHER PROCEDURAL SFX =====================

  // Footstep Tap (soft runner stride)
  public playFootstep() {
    if (this.isMuted || this.isPaused || this.gameOverSoundPlayed) return;
    this.unlockAudio();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110 + Math.random() * 20, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);

      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.06);
    } catch (_) {}
  }

  // Diamond Collect Sound (sparkle arpeggio)
  public playDiamond() {
    if (this.isMuted || this.isPaused || this.gameOverSoundPlayed) return;
    this.unlockAudio();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const notes = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const noteTime = t + i * 0.045;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.22, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.3);
      });
    } catch (_) {}
  }

  // Police Siren Alert
  public playPoliceSiren() {
    if (this.isMuted || this.isPaused || this.gameOverSoundPlayed) return;
    this.unlockAudio();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(680, t);
      osc.frequency.linearRampToValueAtTime(940, t + 0.15);
      osc.frequency.linearRampToValueAtTime(680, t + 0.3);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);

      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.36);
    } catch (_) {}
  }

  // Game Start Fanfare
  public playGameStart() {
    if (this.isMuted) return;
    this.unlockAudio();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const noteTime = t + i * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.24);
      });
    } catch (_) {}
  }

  // Milestone Fanfare
  public playMilestone() {
    if (this.isMuted || this.isPaused || this.gameOverSoundPlayed) return;
    this.unlockAudio();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const notes = [587.33, 880, 1174.66]; // D5, A5, D6
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const noteTime = t + i * 0.07;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.15, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.35);
      });
    } catch (_) {}
  }

  // Background Synthwave Pulse
  public startBGM() {
    if (this.isBgmPlaying) return;
    this.unlockAudio();
    if (!this.ctx) return;

    this.isBgmPlaying = true;
    let step = 0;
    const bassNotes = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42];

    const tick = () => {
      if (!this.isBgmPlaying || !this.ctx) return;
      const t = this.ctx.currentTime;

      if (!this.isMuted && !this.isPaused) {
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const noteFreq = bassNotes[step % bassNotes.length];

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(noteFreq, t);

          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(320, t);

          gain.gain.setValueAtTime(0.045, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + 0.14);

          if (step % 2 === 1) {
            const hatOsc = this.ctx.createOscillator();
            const hatFilter = this.ctx.createBiquadFilter();
            const hatGain = this.ctx.createGain();

            hatOsc.type = 'square';
            hatOsc.frequency.setValueAtTime(8000, t);

            hatFilter.type = 'highpass';
            hatFilter.frequency.setValueAtTime(6000, t);

            hatGain.gain.setValueAtTime(0.012, t);
            hatGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

            hatOsc.connect(hatFilter);
            hatFilter.connect(hatGain);
            hatGain.connect(this.ctx.destination);

            hatOsc.start(t);
            hatOsc.stop(t + 0.05);
          }
        } catch (_) {}
      }

      step++;
      const stepDuration = 60 / this.tempo / 2;
      this.bgmTimer = window.setTimeout(tick, stepDuration * 1000);
    };

    tick();
  }

  public stopBGM() {
    this.isBgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  public updateTempo(speedRatio: number) {
    this.tempo = Math.min(150, 124 + (speedRatio - 1) * 20);
  }
}

export const sound = new SoundSystem();
