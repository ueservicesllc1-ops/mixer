
'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from './ui/button';
import { Youtube, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import GraphicEq from './GraphicEq';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface LyricsDisplayProps {
  lyrics: string | null;
  youtubeUrl: string | null;
  onOpenYouTube: () => void;
  onOpenTeleprompter: () => void;
  eqBands: number[];
  onEqChange: (bandIndex: number, value: number) => void;
  onReset: () => void;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ 
    lyrics, 
    youtubeUrl, 
    onOpenYouTube,
    onOpenTeleprompter,
    eqBands,
    onEqChange,
    onReset
}) => {
  return (
    <div className="flex gap-4 h-full">
        <Popover>
            <PopoverTrigger asChild>
                <button 
                    className={cn(
                        "relative rounded-lg overflow-hidden group h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background flex-1"
                    )}
                >
                    <Image
                        src="https://picsum.photos/seed/eq-button/600/400"
                        alt="Equalizer"
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        data-ai-hint="audio mixer knobs"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="font-bold text-xl text-white drop-shadow-lg flex items-center gap-2">
                            <SlidersHorizontal />
                            EQ
                        </span>
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] h-[300px] bg-card/80 backdrop-blur-sm border-border">
                <GraphicEq bands={eqBands} onBandChange={onEqChange} onReset={onReset} />
            </PopoverContent>
        </Popover>

       <button 
          className={cn(
            "relative rounded-lg overflow-hidden group h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background flex-1",
            !youtubeUrl && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => youtubeUrl && onOpenYouTube()}
          disabled={!youtubeUrl}
        >
        <Image
          src="https://picsum.photos/seed/youtube-btn/600/400"
          alt="YouTube"
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          data-ai-hint="video play button"
        />
         <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
             <span className="font-bold text-xl text-white drop-shadow-lg flex items-center gap-2">
                <Youtube />
                YouTube
             </span>
         </div>
      </button>
      <button 
        className={cn(
            "relative rounded-lg overflow-hidden group h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background flex-1",
            !lyrics && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => lyrics && onOpenTeleprompter()}
        disabled={!lyrics}
        >
        <Image
          src="https://picsum.photos/seed/lights/600/400"
          alt="Teleprompter"
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          data-ai-hint="stage lights"
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
             <span className="font-bold text-xl text-white drop-shadow-lg">Teleprompter</span>
         </div>
      </button>
    </div>
  );
};

export default LyricsDisplay;
