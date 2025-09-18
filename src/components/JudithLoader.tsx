'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface JudithLoaderProps {
  isVisible: boolean;
}

const JudithLoader: React.FC<JudithLoaderProps> = ({ isVisible }) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (isVisible) {
      setCountdown(5); // Reset countdown
      const timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
        <div className="text-center">
            <h1 className="font-mono text-7xl font-bold text-amber-400 [text-shadow:0_0_15px_theme(colors.amber.400)]">
                Judith 1.0
            </h1>
            <p className="font-mono text-xl text-amber-400/70 mt-2">Preparando pista para reproducción...</p>
        </div>
        <div className="flex items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <span className="font-mono text-5xl text-primary">{countdown}</span>
        </div>
    </div>
  );
};

export default JudithLoader;
