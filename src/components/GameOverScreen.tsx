import React, { useEffect, useState } from 'react';
import { RotateCcw, Trophy, Share2, Check, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { GameMetrics } from '../game/types';

interface GameOverScreenProps {
  metrics: GameMetrics;
  onRestart: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ metrics, onRestart }) => {
  const [copied, setCopied] = useState(false);
  const isNewRecord = metrics.score >= metrics.bestScore && metrics.score > 0;

  useEffect(() => {
    if (isNewRecord) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#00f0ff', '#fbbf24', '#38bdf8', '#ffffff'],
        });
      } catch {
        // Fallback
      }
    }
  }, [isNewRecord]);

  const handleShare = () => {
    const text = `💎 I ran ${metrics.distance}m, collected ${metrics.diamonds} diamonds, and scored ${metrics.score.toLocaleString()} in TTF RUN! Can you beat my score? 🚔⚡`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const formatDistance = (m: number) => {
    if (m >= 1000) {
      return `${(m / 1000).toFixed(2)} km`;
    }
    return `${m} m`;
  };

  return (
    <div className="modal-overlay game-over-overlay">
      <div className="modal-card game-over-border">
        {/* Subtle Ambient Background Glows */}
        <div className="menu-ambient-glow-gold" />
        <div className="menu-ambient-glow-blue" />

        {/* Official Logo at the Top */}
        <div className="gameover-logo-container">
          <img
            src="/assets/ttf-run-logo.png"
            alt="TTF RUN official game logo"
            className="gameover-logo-image"
          />
        </div>

        {/* New Record Banner */}
        {isNewRecord && (
          <div className="record-badge pulse-glow">
            <Award size={15} color="#fde047" />
            <span>🎉 NEW RECORD REACHED!</span>
          </div>
        )}

        {/* Title */}
        <h2 className="modal-title danger-title">
          GAME OVER
        </h2>
        <p className="modal-subtitle">
          The police cruiser blocked your path. Time your jumps carefully!
        </p>

        {/* Stats Grid */}
        <div className="stats-grid">
          {/* Distance */}
          <div className="stat-card">
            <div className="stat-card-label">Distance Ran</div>
            <div className="stat-card-value">{formatDistance(metrics.distance)}</div>
          </div>

          {/* Diamonds */}
          <div className="stat-card diamond-card">
            <div className="stat-card-label" style={{ color: '#38bdf8' }}>Diamonds</div>
            <div className="stat-card-value" style={{ color: '#38bdf8' }}>
              <span>💎</span>
              <span>{metrics.diamonds}</span>
            </div>
          </div>

          {/* Final Score */}
          <div className="stat-card">
            <div className="stat-card-label">Final Score</div>
            <div className="stat-card-value score-val">{metrics.score.toLocaleString()}</div>
          </div>

          {/* Best Score */}
          <div className="stat-card">
            <div className="stat-card-label">
              <Trophy size={12} color="#fbbf24" />
              <span>Best Score</span>
            </div>
            <div className="stat-card-value">{metrics.bestScore.toLocaleString()}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            onClick={onRestart}
            className="btn-primary"
            id="play-again-btn"
            autoFocus
          >
            <RotateCcw size={18} />
            <span>PLAY AGAIN</span>
          </button>

          <button
            onClick={handleShare}
            className="btn-secondary"
            title="Share your score"
          >
            {copied ? (
              <>
                <Check size={16} color="#34d399" />
                <span style={{ color: '#34d399' }}>COPIED!</span>
              </>
            ) : (
              <>
                <Share2 size={16} />
                <span>SHARE</span>
              </>
            )}
          </button>
        </div>

        <div style={{ marginTop: '16px', fontSize: '0.78rem', color: '#94a3b8' }}>
          Press <strong style={{ color: '#f8fafc' }}>SPACE</strong> or{' '}
          <strong style={{ color: '#f8fafc' }}>ENTER</strong> to restart
        </div>
      </div>
    </div>
  );
};
