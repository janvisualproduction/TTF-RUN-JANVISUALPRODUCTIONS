import React from 'react';
import { Volume2, VolumeX, Pause, Play, Maximize, Trophy, Zap } from 'lucide-react';
import type { GameMetrics, GameState } from '../game/types';

interface HUDProps {
  metrics: GameMetrics;
  gameState: GameState;
  isMuted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onToggleFullscreen: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  metrics,
  gameState,
  isMuted,
  onToggleMute,
  onTogglePause,
  onToggleFullscreen,
}) => {
  const formatDistance = (m: number) => {
    if (m >= 1000) {
      return `${(m / 1000).toFixed(2)} km`;
    }
    return `${m} m`;
  };

  const formatScore = (num: number) => {
    return num.toString().padStart(6, '0');
  };

  return (
    <div className="hud-bar">
      {/* Left: Official In-Game Branding Corner & Speed */}
      <div className="hud-left">
        <div className="hud-badge">
          {/* Subtle Mini Logo Thumbnail */}
          <img
            src="/assets/ttf-run-logo.png"
            alt="TTF RUN official game logo"
            className="hud-mini-logo"
          />
          <span className="hud-brand">TTF RUN</span>
          <span>💎</span>
        </div>

        {gameState === 'PLAYING' && (
          <div className="hud-speed-badge">
            <Zap size={14} className="pulse-glow" />
            <span>{metrics.speedMultiplier}x SPEED</span>
          </div>
        )}
      </div>

      {/* Center: Distance, Diamonds, Score & High Score */}
      <div className="hud-center">
        {/* Distance */}
        <div className="hud-stat-box">
          <div className="hud-stat-label">DISTANCE</div>
          <div className="hud-stat-value">{formatDistance(metrics.distance)}</div>
        </div>

        {/* Diamonds */}
        <div className="hud-stat-box diamonds-box">
          <div className="hud-stat-label">DIAMONDS</div>
          <div className="hud-stat-value cyan-glow">
            💎 {metrics.diamonds}
          </div>
        </div>

        {/* Score & Best */}
        <div className="hud-stat-box best-box">
          <div className="hud-stat-label">
            <Trophy size={11} color="#fbbf24" />
            <span style={{ color: '#fbbf24' }}>HI {formatScore(metrics.bestScore)}</span>
          </div>
          <div className="hud-stat-value">{formatScore(metrics.score)}</div>
        </div>
      </div>

      {/* Right: Sound & Action Buttons */}
      <div className="hud-right">
        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <button
            onClick={onTogglePause}
            className="btn-icon"
            title={gameState === 'PAUSED' ? 'Resume Game' : 'Pause Game'}
            aria-label="Pause or Resume"
          >
            {gameState === 'PAUSED' ? <Play size={18} color="#00f0ff" /> : <Pause size={18} />}
          </button>
        )}

        <button
          onClick={onToggleMute}
          className="btn-icon"
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          aria-label="Toggle Sound"
        >
          {isMuted ? <VolumeX size={18} color="#ef4444" /> : <Volume2 size={18} color="#00f0ff" />}
        </button>

        <button
          onClick={onToggleFullscreen}
          className="btn-icon"
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
        >
          <Maximize size={18} />
        </button>
      </div>
    </div>
  );
};
