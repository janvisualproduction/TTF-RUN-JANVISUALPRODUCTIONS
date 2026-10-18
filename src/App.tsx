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
  }, [handleMilestoneNotice]);

  // Loading animation timer
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  // Handle keyboard inputs
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
    // Avoid triggering jump if clicked on interactive buttons
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }

    if (e.type === 'touchstart') {
      // Prevent double firing or scrolling
      e.preventDefault();
    }

    if (engineRef.current) {
      engineRef.current.jump();
    }
  };

  const handleStartGame = () => {
    if (engineRef.current) {
      engineRef.current.start();
    }
  };

  const handleRestartGame = () => {
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
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
      {/* Game Viewport Container */}
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

        {/* Milestone Toast (50m diamond alerts) */}
        {gameState === 'PLAYING' && <MilestoneToast message={toastMessage} />}

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

      {/* Footer Info */}
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
    </div>
  );
}

export default App;
