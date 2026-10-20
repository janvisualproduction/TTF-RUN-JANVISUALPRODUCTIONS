import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface TouchControlsProps {
  onJump: () => void;
  onFastFall: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onJump, onFastFall }) => {
  // Use pointerdown/touchstart for immediate 0ms response without click delay
  const handleJumpPress = (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onJump();
  };

  const handleDivePress = (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFastFall();
  };

  return (
    <div className="touch-controls-layer" aria-label="On-Screen Touch Controls">
      {/* Bottom Left: Fast Fall / Dive Button */}
      <div className="touch-control-zone touch-zone-left">
        <button
          type="button"
          className="touch-btn touch-btn-dive"
          onPointerDown={handleDivePress}
          onTouchStart={handleDivePress}
          aria-label="Dive or Fast Fall"
          title="Dive / Fast Fall (Down Arrow)"
        >
          <ArrowDown size={28} strokeWidth={2.6} />
          <span className="touch-btn-label">DIVE</span>
        </button>
      </div>

      {/* Bottom Right: Big Primary Jump Button */}
      <div className="touch-control-zone touch-zone-right">
        <button
          type="button"
          className="touch-btn touch-btn-jump"
          onPointerDown={handleJumpPress}
          onTouchStart={handleJumpPress}
          aria-label="Jump"
          title="Jump (Tap or Space)"
        >
          <ArrowUp size={34} strokeWidth={2.8} />
          <span className="touch-btn-label">JUMP</span>
        </button>
      </div>
    </div>
  );
};
