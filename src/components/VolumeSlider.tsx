
'use client';

import React, { useMemo } from 'react';
import { Slider } from './ui/slider';
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
    
    const vuMeterLevel = useMemo(() => {
        const level = Math.max(0, (vuLevel + 48) / 48) * 100;
        return Math.min(level, 100);
    }, [vuLevel]);

    return (
        <div className="flex items-center gap-3 w-full">
            <span className="font-bold text-sm w-16 text-right">{label}</span>
             <div className="relative flex-grow h-10 rounded-md border border-border/50 bg-black/30 p-2 flex items-center gap-4">
                <div className="absolute top-1 left-2 flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_4px_theme(colors.blue.500)]" />
                    <div className={cn(
                        "w-2 h-2 rounded-full bg-red-500 transition-opacity",
                        isClipping ? "opacity-100 shadow-[0_0_4px_theme(colors.red.500)]" : "opacity-20"
                    )} />
                </div>
                <div className="relative w-full h-full flex items-center">
                    <Slider
                        value={[volume]}
                        max={100}
                        step={1}
                        onValueChange={(val) => onVolumeChange(val[0])}
                        className="w-full"
                    />
                </div>
                 <div className="absolute right-2 top-0 bottom-0 flex items-center">
                    <VuMeter level={vuMeterLevel} orientation="horizontal" />
                </div>
            </div>
        </div>
    );
}

export default VolumeSlider;
    
