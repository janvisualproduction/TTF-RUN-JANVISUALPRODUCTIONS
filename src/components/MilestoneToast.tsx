import React from 'react';

interface MilestoneToastProps {
  message: string | null;
}

export const MilestoneToast: React.FC<MilestoneToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="milestone-toast-container">
      <div className="milestone-toast">
        <span>{message}</span>
      </div>
    </div>
  );
};
