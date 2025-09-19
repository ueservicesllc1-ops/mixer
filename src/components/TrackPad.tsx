
'use client';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { cn } from '@/lib/utils';
import { SetlistSong } from '@/actions/setlists';
import VuMeter from './VuMeter';
import TempoLed from './TempoLed';
import { Input } from './ui/input';

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
  localName: string | undefined;
  onNameChange: (newName: string) => void;
}

const LONG_PRESS_DURATION = 2000; // 2 segundos

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
  onMuteToggle,
  localName,
  onNameChange
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [inputValue, setInputValue] = useState(localName || track.name);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(localName || track.name);
  }, [localName, track.name]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleMouseDown = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsEditingName(true);
    }, LONG_PRESS_DURATION);
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleNameSubmit = () => {
    if (inputValue.trim()) {
      onNameChange(inputValue.trim());
    } else {
      setInputValue(localName || track.name); // Revert if empty
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    }
    if (e.key === 'Escape') {
      setInputValue(localName || track.name);
      setIsEditingName(false);
    }
  };

  const volumeSliderValue = useMemo(() => [volume], [volume]);
  
  const isGuideTrack = useMemo(() => {
    const upperCaseName = track.name.trim().toUpperCase();
    const guideNames = ['CUES', 'GUIA', 'GUIDES', 'GUIDE'];
    return upperCaseName === 'CLICK' || guideNames.includes(upperCaseName);
  }, [track.name]);

  const isClickTrack = useMemo(() => track.name.trim().toUpperCase() === 'CLICK', [track.name]);

  const vuMeterLevel = useMemo(() => {
    const level = Math.max(0, (vuLevel + 48) / 48) * 100;
    return Math.min(level, 100);
  }, [vuLevel]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div 
        className={cn(
            "w-full text-center bg-black/80 rounded-md px-1 py-1 h-8 flex items-center justify-center cursor-pointer select-none",
            isGuideTrack 
                ? "border border-destructive/40" 
                : "border border-blue-500/20"
        )}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        {isEditingName ? (
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className={cn(
                "w-full h-full p-0 m-0 bg-transparent border-none text-center font-mono text-sm focus:ring-0 focus:outline-none",
                isGuideTrack 
                    ? "text-destructive [text-shadow:0_0_8px_theme(colors.destructive)]"
                    : "text-blue-400 [text-shadow:0_0_8px_theme(colors.blue.500)]"
            )}
          />
        ) : (
          <span className={cn(
            "font-mono text-sm truncate block w-full",
            isGuideTrack 
                ? "text-destructive [text-shadow:0_0_8px_theme(colors.destructive)]"
                : "text-blue-400 [text-shadow:0_0_8px_theme(colors.blue.500)]"
          )}>
            {localName || track.name}
          </span>
        )}
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

    