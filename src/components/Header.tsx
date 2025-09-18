
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Rewind, Play, Pause, Square, FastForward, Settings, Loader2, Plus, Minus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import Timeline from './Timeline';
import { SongStructure } from '@/ai/flows/song-structure';
import SettingsDialog from './SettingsDialog';
import { Input } from './ui/input';
import type { Song } from '@/actions/songs';
import VolumeSlider from './VolumeSlider';

interface HeaderProps {
  isPlaying: boolean;
  isPreparingPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind?: () => void;
  onFastForward?: () => void;
  onSeek: (position: number) => void;
  currentTime: number;
  duration: number;
  isReadyToPlay: boolean;
  songStructure?: SongStructure | null;
  fadeOutDuration: number;
  onFadeOutDurationChange: (duration: number) => void;
  isPanVisible: boolean;
  onPanVisibilityChange: (isVisible: boolean) => void;
  activeSong: Song | undefined;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  onBpmChange: (bpm: number) => void;
  pitch: number;
  onPitchChange: (pitch: number) => void;
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
  masterVuLevel: number;
}

const Header: React.FC<HeaderProps> = ({
  isPlaying,
  isPreparingPlay,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onFastForward,
  onSeek,
  currentTime = 0,
  duration = 0,
  isReadyToPlay,
  songStructure,
  fadeOutDuration,
  onFadeOutDurationChange,
  isPanVisible,
  onPanVisibilityChange,
  activeSong,
  playbackRate,
  onBpmChange,
  pitch,
  onPitchChange,
  masterVolume,
  onMasterVolumeChange,
  masterVuLevel,
}) => {
  const currentBPM = activeSong?.tempo ? activeSong.tempo * playbackRate : null;
  const [bpmInput, setBpmInput] = useState<string>('');

  useEffect(() => {
    if (currentBPM !== null) {
      setBpmInput(currentBPM.toFixed(1));
    } else {
      setBpmInput('--');
    }
  }, [currentBPM]);

  const handleBpmInput = (e: React.ChangeEvent<HTMLInputElement>) => setBpmInput(e.target.value);

  const handleBpmInputBlur = () => {
    const newBpm = parseFloat(bpmInput);
    if (!isNaN(newBpm) && newBpm > 0) {
      onBpmChange(newBpm);
    } else {
      setBpmInput(currentBPM ? currentBPM.toFixed(1) : '--');
    }
  }

  const handleBpmInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleBpmInputBlur();
        e.currentTarget.blur();
    }
  }
  
  const handleBpmStep = (amount: number) => {
    if (currentBPM) onBpmChange(currentBPM + amount);
  }

  const displayNote = activeSong?.key ? cn(activeSong.key, pitch) : '-';

  return (
    <header className="flex flex-col bg-card/50 border-b border-border p-2 gap-2 rounded-lg">
      <div className="flex items-center justify-between gap-6">
         <div className="w-64">
            <VolumeSlider
                label="Master"
                volume={masterVolume}
                onVolumeChange={onMasterVolumeChange}
                vuLevel={masterVuLevel}
            />
        </div>
        
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/80 border border-amber-400/20 rounded-md h-12">
                 <Button variant="ghost" size="icon" className="w-10 h-10 text-amber-400/70" onClick={() => handleBpmStep(-1)} disabled={!activeSong}>
                    <Minus className="w-5 h-5" />
                 </Button>
                 <div className="flex flex-col items-center justify-center px-1 py-1 w-20">
                    <Input
                        type="text" value={bpmInput} onChange={handleBpmInput} onBlur={handleBpmInputBlur}
                        onKeyPress={handleBpmInputKeyPress} disabled={!activeSong?.tempo}
                        className="w-full h-full p-0 m-0 bg-transparent border-none text-center font-mono text-xl font-bold text-amber-400 [text-shadow:0_0_8px_theme(colors.amber.400)] focus:ring-0 focus:outline-none"
                    />
                    <span className="text-xs font-mono text-amber-400/70 -mt-1">BPM</span>
                 </div>
                 <Button variant="ghost" size="icon" className="w-10 h-10 text-amber-400/70" onClick={() => handleBpmStep(1)} disabled={!activeSong}>
                    <Plus className="w-5 h-5" />
                 </Button>
            </div>
        </div>
        
         <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/80 border border-amber-400/20 rounded-md h-12 px-3">
                 <Button variant="ghost" size="icon" className="w-10 h-10 text-amber-400/70" onClick={() => onPitchChange(pitch - 1)} disabled={!activeSong}>
                    <Minus className="w-5 h-5" />
                 </Button>
                <div className="bg-black/80 border border-amber-400/20 rounded-md px-2 py-1 w-20 text-center mx-2">
                    <span className="font-mono text-lg text-amber-400 [text-shadow:0_0_8px_theme(colors.amber.400)]">{displayNote}</span>
                    <span className="text-xs font-mono text-amber-400/70 -mt-1 block">PITCH</span>
                </div>
                 <Button variant="ghost" size="icon" className="w-10 h-10 text-amber-400/70" onClick={() => onPitchChange(pitch + 1)} disabled={!activeSong}>
                    <Plus className="w-5 h-5" />
                 </Button>
                 <Button variant="ghost" size="icon" className="w-10 h-10 text-amber-400/70 ml-2" onClick={() => onPitchChange(0)} disabled={!activeSong}>
                    <RotateCcw className="w-4 h-4" />
                 </Button>
            </div>
        </div>

        <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1 bg-background p-1 rounded-lg">
                <Button variant="secondary" size="icon" className="w-12 h-10" onClick={onRewind} disabled={!isReadyToPlay || isPreparingPlay}><Rewind className="w-6 h-6" /></Button>
                <div className="bg-white rounded-lg p-1">
                    <Button variant="secondary" size="icon" className={cn("w-20 h-10 bg-white text-black hover:bg-neutral-200", (!isReadyToPlay || isPreparingPlay) && "bg-neutral-300 text-neutral-500 cursor-not-allowed")} onClick={isPlaying ? onPause : onPlay} disabled={!isReadyToPlay || isPreparingPlay}>
                        {isPreparingPlay ? <Loader2 className="w-8 h-8 animate-spin" /> : isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                    </Button>
                </div>
                <Button variant="secondary" size="icon" className="w-12 h-10" onClick={onStop} disabled={!isReadyToPlay || isPreparingPlay}><Square className="w-6 h-6" /></Button>
                <Button variant="secondary" size="icon" className="w-12 h-10" onClick={onFastForward} disabled={!isReadyToPlay || isPreparingPlay}><FastForward className="w-6 h-6" /></Button>
            </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 ml-auto">
            <SettingsDialog fadeOutDuration={fadeOutDuration} onFadeOutDurationChange={onFadeOutDurationChange} isPanVisible={isPanVisible} onPanVisibilityChange={onPanVisibilityChange}>
                <Button variant="ghost" size="icon"><Settings /></Button>
            </SettingsDialog>
        </div>
      </div>
      
      <Timeline currentTime={currentTime} duration={duration} onSeek={onSeek} structure={songStructure} isReady={isReadyToPlay} />

    </header>
  );
};

export default Header;
