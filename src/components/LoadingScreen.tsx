import React from 'react';

interface LoadingScreenProps {
  progress?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress = 100 }) => {
  return (
    <div className="loading-screen-overlay">
      <div className="loading-card">
        {/* Official Logo with Soft Glow */}
        <div className="loading-logo-wrapper">
          <img
            src="/assets/ttf-run-logo.png"
            alt="TTF RUN official game logo"
            className="loading-logo-img"
          />
        </div>

        {/* Loading Bar & Indicator */}
        <div className="loading-bar-container">
          <div
            className="loading-bar-fill"
            style={{ width: `${Math.min(100, Math.max(10, progress))}%` }}
          />
        </div>

        <div className="loading-text font-arcade">
          <span>INITIALIZING HIGHWAY...</span>
        </div>
      </div>
    </div>
  );
};
