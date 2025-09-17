
'use client';

import React from 'react';
import { Slider } from './ui/slider';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { RotateCcw } from 'lucide-react';

interface GraphicEqProps {
  bands: number[]; // Array de 5 valores (0-100)
  onBandChange: (bandIndex: number, value: number) => void;
  onReset: () => void;
}

const bandFrequencies = ['60', '250', '1k', '4k', '8k'];

const EqTickMarks = React.memo(() => {
    // El rango total es de 24dB (-12 a +12).
    const MAX_GAIN = 12; 
    const TOTAL_RANGE = MAX_GAIN * 2;

    const marks = [
        { gain: 10,  label: "+10" },
        { gain: 5,   label: "+5" },
        { gain: 0,   label: "0" },
        { gain: -5,  label: "-5" },
        { gain: -10, label: "-10" },
    ];
    
    return (
        <div className="absolute h-full w-full pointer-events-none text-[8px] text-muted-foreground/70 inset-0 py-2">
            {marks.map((mark) => {
                // Convertir la ganancia en dB a un porcentaje del recorrido total (0-100)
                const sliderValue = ((mark.gain + MAX_GAIN) / TOTAL_RANGE) * 100;
                const isZero = mark.gain === 0;

                return (
                    <div key={mark.gain} className="absolute w-full flex items-center" style={{bottom: `calc(${sliderValue}% - 4px)`}}>
                         <span className={cn(
                            "absolute text-center",
                             isZero ? "-left-4" : "-left-3.5",
                         )}>
                            {mark.label}
                        </span>
                        <div className={cn(
                            "w-full h-px",
                            isZero ? "bg-muted-foreground/70" : "bg-muted-foreground/30"
                        )} />
                    </div>
                );
            })}
        </div>
    );
});
EqTickMarks.displayName = 'EqTickMarks';

const GraphicEq: React.FC<GraphicEqProps> = ({ bands, onBandChange, onReset }) => {
  return (
    <div className="relative flex justify-around items-end h-full w-full gap-3 px-4 pb-1">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 w-6 h-6 text-muted-foreground hover:text-primary"
        onClick={onReset}
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
      {bands.map((bandValue, index) => (
        <div key={index} className="flex flex-col items-center justify-end h-full w-full gap-1">
          <div className="relative h-full w-4 flex justify-center">
            <EqTickMarks />
            <Slider
              value={[bandValue]}
              max={100}
              step={1}
              orientation="vertical"
              onValueChange={(val) => onBandChange(index, val[0])}
              className="h-full w-4 [&>span:first-child]:bg-transparent"
              trackClassName="bg-input"
              rangeClassName="bg-gradient-to-t from-destructive via-yellow-500 to-green-500"
              thumbClassName="h-3 w-5 rounded-sm bg-foreground border-none cursor-pointer"
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{bandFrequencies[index]}</span>
        </div>
      ))}
    </div>
  );
};

export default GraphicEq;
