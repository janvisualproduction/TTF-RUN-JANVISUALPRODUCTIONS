import { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import { GameEngine } from './game/engine';
import type { GameMetrics, GameState } from './game/types';
import { sound } from './game/audio';
import { HUD } from './components/HUD';
import { StartScreen } from './components/StartScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { PauseScreen } from './components/PauseScreen';
import { MilestoneToast } from './components/MilestoneToast';
import { LoadingScreen } from './components/LoadingScreen';
import { RotateOverlay } from './components/RotateOverlay';
import { TouchControls } from './components/TouchControls';
import { Maximize } from 'lucide-react';
import {
  isMobileDevice,
  isTouchDevice,
  isPortraitMobile,
  enterMobileFullscreen,
} from './utils/device';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [gameState, setGameState] = useState<GameState>('START');
  const [metrics, setMetrics] = useState<GameMetrics>({
    distance: 0,
    score: 0,
    diamonds: 0,
    bestScore: 0,
    speed: 360,
    speedMultiplier: 1.0,
  });
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Strict mobile touch phone/tablet detection (Rule: (pointer: coarse) && min(w, h) < 900)
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileDevice());
  const [isTouch, setIsTouch] = useState<boolean>(() => isTouchDevice());
  const [isPortrait, setIsPortrait] = useState<boolean>(() => isPortraitMobile());
  const [showFullscreenRestoreBtn, setShowFullscreenRestoreBtn] = useState<boolean>(false);
  const wasPlayingBeforeRotateRef = useRef<boolean>(false);

  // Show floating milestone notice
  const handleMilestoneNotice = useCallback((text: string) => {
    setToastMessage(text);
    if (toastTimeoutRef.current !== null) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);

  // Initialize game engine
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const engine = new GameEngine(canvasRef.current, {
        onStateChange: (state) => setGameState(state),
        onMetricsUpdate: (newMetrics) => setMetrics(newMetrics),
        onMilestoneNotice: handleMilestoneNotice,
      });

      engineRef.current = engine;

      // Render preview scene on start screen
      engine.renderPreviewFrame();

      return () => {
        engine.destroy();
      };
    } catch (err) {
      console.error('Failed to initialize GameEngine:', err);
    }
  }, [handleMilestoneNotice]);

  // Loading animation timer
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  // Viewport dimensions, CSS variables & orientation change listeners
  useEffect(() => {
    const updateDimensions = () => {
      try {
        const mobile = isMobileDevice();
        setIsMobile(mobile);

        const touch = isTouchDevice();
        setIsTouch(touch);

        // Portrait overlay check runs ONLY for mobile phones
        const portrait = isPortraitMobile();
        setIsPortrait(portrait);

        // Real visible height (window.innerHeight) ensures clean full display whether or not browser bar shows
        const vh = window.innerHeight;
        if (vh > 0) {
          document.documentElement.style.setProperty('--app-height', `${vh}px`);
        }

        // Inform engine of resize/DPR change
        if (engineRef.current) {
          engineRef.current.resize();
        }
      } catch {
        // Silently safeguard against measurement errors
      }
    };

    updateDimensions();

    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);
    window.visualViewport?.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
      window.visualViewport?.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Fullscreen on very first touch anywhere on mobile
  useEffect(() => {
    if (!isMobile) return;

    const handleFirstTouch = () => {
      try {
        enterMobileFullscreen();
      } catch {}
    };

    window.addEventListener('touchstart', handleFirstTouch, { capture: true, once: true });
    return () => {
      window.removeEventListener('touchstart', handleFirstTouch, { capture: true });
    };
  }, [isMobile]);

  // Detect fullscreen exit during active gameplay on mobile (do not auto-pause)
  useEffect(() => {
    const handleFullscreenChange = () => {
      try {
        const doc = document as any;
        const isFullscreen = !!(document.fullscreenElement || doc.webkitFullscreenElement);
        if (isMobile && gameState === 'PLAYING' && !isFullscreen) {
          setShowFullscreenRestoreBtn(true);
        } else if (isFullscreen) {
          setShowFullscreenRestoreBtn(false);
        }
      } catch {}
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isMobile, gameState]);

  // Automatic pause & resume when mobile device is rotated
  useEffect(() => {
    if (!isMobile) return;

    if (isPortrait) {
      // Rotated to portrait: pause if currently running
      if (gameState === 'PLAYING') {
        wasPlayingBeforeRotateRef.current = true;
        if (engineRef.current) {
          engineRef.current.pause();
        }
      }
    } else {
      // Rotated back to landscape: resume if was previously running
      if (wasPlayingBeforeRotateRef.current) {
        wasPlayingBeforeRotateRef.current = false;
        if (engineRef.current) {
          engineRef.current.resume();
        }
      }
    }
  }, [isPortrait, isMobile, gameState]);

  // Handle tab visibility change (pause BGM when tab is hidden, resume when tab is visible again)
  useEffect(() => {
    const handleVisibilityChange = () => {
      try {
        if (document.hidden) {
          sound.pauseBGM();
        } else {
          // Resume only if game is currently actively playing and not blocked by rotate overlay
          if (engineRef.current?.getState() === 'PLAYING' && !isPortrait) {
            sound.resumeBGM();
          }
        }
      } catch {
        // Silently safeguard
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPortrait]);

  // Handle keyboard inputs on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        engineRef.current.jump();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        engineRef.current.fastFall();
      } else if (e.code === 'Enter') {
        if (gameState === 'GAMEOVER' || gameState === 'START') {
          e.preventDefault();
          engineRef.current.jump();
        }
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        engineRef.current.togglePause();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        const newMuted = sound.toggleMute();
        setIsMuted(newMuted);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Touch / Click Handler for Game Container
  const handleContainerInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    // Avoid triggering jump if clicked on interactive buttons or controls
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('.touch-btn')) {
      return;
    }

    // Only preventDefault on touch events
    if (e.type === 'touchstart') {
      if ((e as React.TouchEvent).cancelable) {
        e.preventDefault();
      }
      if (isMobile) {
        enterMobileFullscreen();
      }
    }

    if (engineRef.current) {
      engineRef.current.jump();
    }
  };

  const handleStartGame = () => {
    // Attempt mobile orientation lock & fullscreen only on mobile touch devices within direct tap gesture
    if (isMobile) {
      enterMobileFullscreen();
    }
    if (engineRef.current) {
      engineRef.current.start();
    }
  };

  const handleRestartGame = () => {
    if (isMobile) {
      enterMobileFullscreen();
    }
    if (engineRef.current) {
      engineRef.current.start();
    }
  };

  const handleTogglePause = () => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  };

  const handleToggleMute = () => {
    const newMuted = sound.toggleMute();
    setIsMuted(newMuted);
  };

  const handleToggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div className={`game-app-shell ${isMobile ? 'is-mobile' : ''}`}>
      {/* Game Viewport Container (Contain-scaled to preserve 1200:540 aspect ratio) */}
      <div
        ref={containerRef}
        className="game-container"
        onClick={handleContainerInteraction}
        onTouchStart={handleContainerInteraction}
        id="ttf-game-viewport"
      >
        {/* Canvas for 60FPS High-DPI graphics */}
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={1200}
          height={540}
        />

        {/* Retro visual scanline and vignette overlay */}
        <div className="scanline-overlay" />
        <div className="vignette-overlay" />

        {/* Live Arcade HUD */}
        <HUD
          metrics={metrics}
          gameState={gameState}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onToggleFullscreen={handleToggleFullscreen}
        />

        {/* Restore Fullscreen Button (Shown on mobile only if player exited fullscreen while game is running) */}
        {isMobile && showFullscreenRestoreBtn && gameState === 'PLAYING' && (
          <button
            className="mobile-restore-fullscreen-btn"
            onClick={(e) => {
              e.stopPropagation();
              enterMobileFullscreen();
              setShowFullscreenRestoreBtn(false);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              enterMobileFullscreen();
              setShowFullscreenRestoreBtn(false);
            }}
            aria-label="Tap to go fullscreen"
          >
            <Maximize size={13} />
            <span>TAP FOR FULLSCREEN</span>
          </button>
        )}

        {/* Milestone Toast (50m diamond alerts) */}
        {gameState === 'PLAYING' && <MilestoneToast message={toastMessage} />}

        {/* Mobile On-Screen Touch Controls (shown ONLY on mobile touch devices while playing) */}
        {isTouch && gameState === 'PLAYING' && (
          <TouchControls
            onJump={() => engineRef.current?.jump()}
            onFastFall={() => engineRef.current?.fastFall()}
          />
        )}

        {/* Loading Screen with Official Logo */}
        {isLoading && <LoadingScreen />}

        {/* Start Screen Overlay */}
        {!isLoading && gameState === 'START' && (
          <StartScreen
            bestScore={metrics.bestScore}
            onPlay={handleStartGame}
          />
        )}

        {/* Game Over Screen Overlay */}
        {gameState === 'GAMEOVER' && (
          <GameOverScreen
            metrics={metrics}
            onRestart={handleRestartGame}
          />
        )}

        {/* Pause Screen Overlay */}
        {gameState === 'PAUSED' && (
          <PauseScreen onResume={handleTogglePause} />
        )}
      </div>

      {/* Footer Info (Desktop friendly - hidden completely on mobile phones) */}
      {!isMobile && (
        <footer className="game-footer">
          <div>
            <strong style={{ color: '#38bdf8' }}>TTF RUN 💎</strong> • Jump over police cars, collect diamonds every 50m!
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <span>Controls: <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#f8fafc' }}>SPACE</kbd> / Tap to Jump</span>
            <span>•</span>
            <span><kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#f8fafc' }}>M</kbd> Mute</span>
          </div>
        </footer>
      )}

      {/* Rotate Device to Landscape Overlay (Shown ONLY on mobile phones in portrait mode) */}
      {isMobile && isPortrait && (
        <RotateOverlay isGameRunning={gameState === 'PAUSED'} />
      )}
    </div>
  );
}

export default App;
