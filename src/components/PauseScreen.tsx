import React from 'react';
import { Play } from 'lucide-react';

interface PauseScreenProps {
  onResume: () => void;
}

export const PauseScreen: React.FC<PauseScreenProps> = ({ onResume }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '380px', padding: '24px' }}>
        <h2 className="modal-title" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>
          PAUSED
        </h2>
        <p className="modal-subtitle" style={{ marginBottom: '20px' }}>
          Catch your breath. The police are waiting!
        </p>

        <button onClick={onResume} className="btn-primary" style={{ width: '100%' }}>
          <Play size={18} fill="currentColor" />
          <span>RESUME</span>
        </button>

        <div style={{ marginTop: '16px', fontSize: '0.75rem', color: '#94a3b8' }}>
          Press <strong style={{ color: '#f8fafc' }}>ESC</strong> or{' '}
          <strong style={{ color: '#f8fafc' }}>P</strong> to resume
        </div>
      </div>
    </div>
  );
};
