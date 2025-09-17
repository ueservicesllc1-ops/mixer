
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SongStructure } from '@/ai/flows/song-structure';

interface TimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (newTime: number) => void;
  structure: SongStructure | null;
  isReady: boolean;
}

const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Timeline: React.FC<TimelineProps> = ({ duration, currentTime, onSeek, structure, isReady }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isReady || !timelineRef.current) return;
    const timeline = timelineRef.current;
    const rect = timeline.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = duration * percentage;
    onSeek(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsSeeking(true);
    handleSeek(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSeeking) {
      handleSeek(e);
    }
  };

  const handleMouseUp = () => {
    setIsSeeking(false);
  };

  const handleMouseLeave = () => {
    setIsSeeking(false);
  };
  
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-1 pt-1">
        <span className="font-mono text-sm text-muted-foreground w-14 text-right">
            {formatTime(currentTime)}
        </span>
        
        <div 
            ref={timelineRef}
            className={cn(
                "relative flex-grow h-6 bg-black/50 rounded-lg cursor-pointer group border border-amber-400/20",
                !isReady && 'opacity-50 cursor-not-allowed'
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            {/* Progress Bar */}
            <div 
                className="absolute top-0 left-0 h-full bg-amber-400/70 rounded-lg shadow-[0_0_8px_1px_theme(colors.amber.400)]"
                style={{ width: `${progressPercentage}%` }}
            />
            {/* Playhead */}
            <div 
                className="absolute top-0 h-full w-0.5 bg-amber-400"
                style={{ left: `${progressPercentage}%` }}
            >
                <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 bg-amber-400 rounded-full" />
            </div>

            {/* Cues / Markers */}
            {structure?.cues && duration > 0 && (
                <div className="relative w-full h-full">
                    {structure.cues.map((cue, index) => {
                        const cuePosition = (cue.time / duration) * 100;
                        // No mostrar cues que estén fuera de la línea de tiempo
                        if (cuePosition < 0 || cuePosition > 100) return null;
                        
                        return (
                            <div 
                                key={index} 
                                className="absolute -top-1 h-full flex flex-col items-center"
                                style={{ left: `${cuePosition}%`}}
                            >
                                <span className="text-xs text-muted-foreground select-none">{cue.label}</span>
                                <div className="h-2 w-px bg-muted-foreground/50 mt-1" />
                                <div className="h-1 w-1 bg-muted-foreground/50 rounded-full" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        
        <span className="font-mono text-sm text-muted-foreground w-14 text-left">
            {formatTime(duration)}
        </span>
    </div>
  );
};

export default Timeline;
