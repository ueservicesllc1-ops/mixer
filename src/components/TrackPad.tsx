'use client';
import React, { useMemo } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { cn } from '@/lib/utils';
import { SetlistSong } from '@/actions/setlists';
import VuMeter from './VuMeter';
import TempoLed from './TempoLed';

interface TrackPadProps {
  track: SetlistSong;
  isMuted: boolean;
  isSolo: boolean;
  volume: number;
  vuLevel: number;
  tempo: number;
  isPlaying: boolean;
  onVolumeChange: (volume: number) => void;
  onSoloToggle: () => void;
  onMuteToggle: () => void;
}

const TrackPad: React.FC<React.memoExoticComponent<any>> = React.memo(({
  track,
  isMuted,
  isSolo,
  volume,
  vuLevel,
  tempo,
  isPlaying,
  onVolumeChange,
  onSoloToggle,
  onMuteToggle
}) => {
  const volumeSliderValue = useMemo(() => [volume], [volume]);
  
  const isClickTrack = useMemo(() => track.name.trim().toUpperCase() === 'CLICK', [track.name]);

  const vuMeterLevel = useMemo(() => {
    // El nivel de vuLevel viene en dB (-Infinity a ~0).
    // Lo mapeamos a un porcentaje (0-100) para el vúmetro.
    // Un rango típico es de -48dB a 0dB.
    const level = Math.max(0, (vuLevel + 48) / 48) * 100;
    return Math.min(level, 100); // Asegurarse de que no pase de 100
  }, [vuLevel]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full text-center bg-black/80 border border-blue-500/20 rounded-md px-1 py-1 h-8 flex items-center justify-center">
        <span className="font-mono text-sm text-blue-400 [text-shadow:0_0_8px_theme(colors.blue.500)] truncate block w-full">
            {!isClickTrack ? track.name : ''}
        </span>
      </div>
        
      <div className="relative h-52 w-24 rounded-md border border-border/20 bg-black/50 p-2 flex justify-center items-center">
        <Slider
            value={volumeSliderValue}
            max={100}
            step={1}
            orientation="vertical"
            onValueChange={(val) => onVolumeChange(val[0])}
        />
        <div className="absolute right-2 top-0 bottom-0 flex items-center">
            {isClickTrack ? (
                <TempoLed tempo={tempo} isPlaying={isPlaying} />
            ) : (
                <VuMeter level={vuMeterLevel} orientation="vertical" />
            )}
        </div>
      </div>

      {/* Contenedor de Botones */}
      <div className="flex gap-1.5 w-full">
        <Button
          onClick={onMuteToggle}
          variant="secondary"
          className={cn(
            'w-full py-1 h-auto text-xs font-bold rounded-sm',
             isMuted ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          )}
        >
          M
        </Button>
        <Button
          onClick={onSoloToggle}
          variant="secondary"
          className={cn(
            'w-full py-1 h-auto text-xs font-bold rounded-sm',
            isSolo ? 'bg-yellow-500 text-black' : 'bg-secondary'
          )}
        >
          S
        </Button>
      </div>
    </div>
  );
});

TrackPad.displayName = 'TrackPad';

export default TrackPad;
