import React from 'react';
import { Smartphone, RefreshCw } from 'lucide-react';

interface RotateOverlayProps {
  isGameRunning: boolean;
}

export const RotateOverlay: React.FC<RotateOverlayProps> = ({ isGameRunning }) => {
  return (
    <div className="rotate-overlay" role="dialog" aria-modal="true" aria-label="Rotate Device to Landscape">
      <div className="rotate-card">
        {/* Animated Rotating Phone Graphic */}
        <div className="rotate-phone-wrapper">
          <div className="rotate-phone-icon">
            <Smartphone size={56} color="#00f0ff" strokeWidth={1.75} />
          </div>
          <div className="rotate-arrow-indicator">
            <RefreshCw size={24} color="#fbbf24" className="rotate-arrow-spin" />
          </div>
        </div>

        {/* Text Instructions */}
        <h2 className="rotate-title">ROTATE YOUR PHONE</h2>
        <p className="rotate-subtitle">
          TTF RUN 💎 is optimized for <strong style={{ color: '#00f0ff' }}>Landscape</strong> mode.
          Turn your device sideways to run!
        </p>

        {/* Game Paused Notice */}
        {isGameRunning && (
          <div className="rotate-paused-pill">
            <span className="pulsing-dot" />
            <span>GAME AUTO-PAUSED</span>
          </div>
        )}
      </div>
    </div>
  );
};
