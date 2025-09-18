
'use client';

import React, { useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import VuMeter from './VuMeter';

interface VolumeSliderProps {
    label: string;
    volume: number;
    vuLevel: number;
    onVolumeChange: (volume: number) => void;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({
    label,
    volume,
    vuLevel,
    onVolumeChange,
}) => {
    const isClipping = vuLevel >= 0;
    const barRef = useRef<HTMLDivElement>(null);
    
    const vuMeterLevel = useMemo(() => {
        const level = Math.max(0, (vuLevel + 48) / 48) * 100;
        return Math.min(level, 100);
    }, [vuLevel]);

    const handleInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!barRef.current) return;
        const rect = barRef.current.getBoundingClientRect();
        
        let clientX;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }

        const newVolume = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        onVolumeChange(newVolume);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        handleInteraction(e);
        const onMouseMove = (moveEvent: MouseEvent) => {
            handleInteraction(moveEvent as any);
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <div className="flex items-center gap-3 w-full">
            <span className="font-bold text-sm w-16 text-right">{label}</span>
             <div 
                ref={barRef}
                className="relative flex-grow h-10 rounded-md border border-border/50 bg-black/30 p-2 flex items-center gap-4 cursor-pointer"
                onMouseDown={handleMouseDown}
             >
                <div className="absolute top-1 left-2 flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_4px_theme(colors.blue.500)]" />
                    <div className={cn(
                        "w-2 h-2 rounded-full bg-red-500 transition-opacity",
                        isClipping ? "opacity-100 shadow-[0_0_4px_theme(colors.red.500)]" : "opacity-20"
                    )} />
                </div>
                
                {/* Volume Fill Bar */}
                <div className="absolute inset-y-0 left-0 h-full bg-primary/70 pointer-events-none" style={{ width: `${volume}%` }} />
                
                <div className="absolute right-2 top-0 bottom-0 flex items-center w-[calc(100%-1rem)] pointer-events-none">
                    <VuMeter level={vuMeterLevel} orientation="horizontal" />
                </div>
            </div>
        </div>
    );
}

export default VolumeSlider;
    
