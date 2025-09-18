'use client';
import React from 'react';
import TrackPad from './TrackPad';
import { SetlistSong } from '@/actions/setlists';
import { Song } from '@/actions/songs';

interface MixerGridProps {
  tracks: SetlistSong[];
  activeSong: Song | undefined;
  soloTracks: string[];
  mutedTracks: string[];
  volumes: { [key: string]: number };
  onMuteToggle: (trackId: string) => void;
  onSoloToggle: (trackId: string) => void;
  onVolumeChange: (trackId: string, newVolume: number) => void;
  vuLevels: Record<string, number>;
  isPlaying: boolean;
  localTrackNames: Record<string, string>;
  onTrackNameChange: (trackId: string, newName: string) => void;
}

const MixerGrid: React.FC<MixerGridProps> = ({ 
  tracks, 
  activeSong,
  soloTracks, 
  mutedTracks,
  volumes,
  onMuteToggle, 
  onSoloToggle,
  onVolumeChange,
  vuLevels,
  isPlaying,
  localTrackNames,
  onTrackNameChange,
}) => {
  const isSoloActive = soloTracks.length > 0;
  const tempo = activeSong?.tempo ?? 120;

  return (
    <div className="grid grid-cols-8 gap-4 items-start">
      {tracks.map(track => {
        const isMuted = mutedTracks.includes(track.id);
        const isSolo = soloTracks.includes(track.id);
        const vuLevel = vuLevels[track.id] ?? -Infinity;
        
        return (
          <TrackPad
            key={track.id}
            track={track}
            isMuted={isMuted}
            isSolo={isSolo}
            volume={volumes[track.id] ?? 100}
            onMuteToggle={() => onMuteToggle(track.id)}
            onSoloToggle={() => onSoloToggle(track.id)}
            onVolumeChange={(newVol) => onVolumeChange(track.id, newVol)}
            vuLevel={vuLevel}
            tempo={tempo}
            isPlaying={isPlaying}
            localName={localTrackNames[track.id]}
            onNameChange={(newName) => onTrackNameChange(track.id, newName)}
          />
        );
      })}
    </div>
  );
};

export default MixerGrid;
