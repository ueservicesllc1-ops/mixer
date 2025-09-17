'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TempoLedProps {
  tempo: number;
  isPlaying: boolean;
}

const TempoLed: React.FC<TempoLedProps> = ({ tempo, isPlaying }) => {
  const animationDuration = 60 / tempo;

  const ledStyle: React.CSSProperties = {
    animationDuration: `${animationDuration}s`,
    animationIterationCount: 'infinite',
    animationName: 'pulse-led',
    animationTimingFunction: 'ease-in-out',
  };

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
      <div
        className={cn(
          'w-2 h-2 rounded-full bg-destructive/20',
          isPlaying && 'animate-pulse-led'
        )}
        style={isPlaying ? ledStyle : {}}
      />
    </div>
  );
};

export default TempoLed;
