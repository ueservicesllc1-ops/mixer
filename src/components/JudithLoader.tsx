'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface JudithLoaderProps {
  isVisible: boolean;
}

const JudithLoader: React.FC<JudithLoaderProps> = ({ isVisible }) => {

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
        <div className="text-center">
            <h1 className="font-mono text-7xl font-bold text-amber-400 [text-shadow:0_0_15px_theme(colors.amber.400)]">
                Judith 1.0
            </h1>
            <p className="font-mono text-xl text-amber-400/70 mt-2">Cargando pistas de audio...</p>
        </div>
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );
};

export default JudithLoader;
