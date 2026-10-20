import React from 'react';
import { Play, Trophy, Smartphone, Keyboard } from 'lucide-react';

interface StartScreenProps {
  bestScore: number;
  onPlay: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ bestScore, onPlay }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-card main-menu-card">
        {/* Subtle Ambient Background Glows complementing Gold & Cyan */}
        <div className="menu-ambient-glow-gold" />
        <div className="menu-ambient-glow-blue" />

        {/* Best Score Badge */}
        {bestScore > 0 && (
          <div className="record-badge">
            <Trophy size={14} color="#fde047" />
            <span>RECORD: {bestScore.toLocaleString()} PTS</span>
          </div>
        )}

        {/* Official TTF RUN Logo (Centerpiece) */}
        <div className="main-logo-container">
          <img
            src="/assets/ttf-run-logo.png"
            alt="TTF RUN official game logo"
            className="main-logo-image"
          />
        </div>

        {/* Tagline */}
        <p className="modal-subtitle">
          Run Fast. Collect Diamonds. Escape the Police!
        </p>

        {/* Play Now CTA (Prominently placed underneath logo) */}
        <button
          onClick={onPlay}
          className="btn-primary main-play-btn"
          id="play-now-btn"
          autoFocus
        >
          <Play size={22} fill="currentColor" />
          <span>PLAY NOW</span>
        </button>

        {/* Controls Info Box */}
        <div className="controls-info">
          <div className="control-item">
            <Keyboard size={16} color="#00f0ff" />
            <span>
              <strong className="control-key">SPACE</strong> or{' '}
              <strong className="control-key">▲</strong> to Jump
            </span>
          </div>
          <div className="control-item">
            <Smartphone size={16} color="#00f0ff" />
            <span>
              <strong className="control-key">TAP SCREEN</strong> on Mobile
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
