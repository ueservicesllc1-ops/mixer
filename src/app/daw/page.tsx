
'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import MixerGrid from '@/components/MixerGrid';
import SongList from '@/components/SongList';
import TonicPad from '@/components/TonicPad';
import { getSetlists, Setlist, SetlistSong } from '@/actions/setlists';
import { Song } from '@/actions/songs';
import LyricsDisplay from '@/components/LyricsDisplay';
import { EqBandCount } from '@/components/Equalizer';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { transposeNote } from '@/lib/utils';
import { getCachedArrayBuffer, cacheArrayBuffer } from '@/lib/audiocache';

const MAX_EQ_GAIN = 12; // in dB

const FREQ_PRESETS: Record<EqBandCount, number[]> = {
    5: [60, 250, 1000, 4000, 8000],
    7: [60, 150, 400, 1000, 2400, 6000, 12000],
    10: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
};

type ToneModule = typeof import('tone');
type TrackNodes = Record<string, {
    player: import('tone').Player;
    panner: import('tone').Panner;
    pitchShift: import('tone').PitchShift;
    volume: import('tone').Volume;
    waveform: import('tone').Waveform;
}>;


const DawPage = () => {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<SetlistSong[]>([]);
  const [soloTracks, setSoloTracks] = useState<string[]>([]);
  const [mutedTracks, setMutedTracks] = useState<string[]>([]);
  const [initialSetlist, setInitialSetlist] = useState<Setlist | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [duration, setDuration] = useState(0);

  const activeSong = useMemo(() => songs.find(s => s.id === activeSongId), [songs, activeSongId]);
  const audioContextStarted = useRef(false);
  const trackNodesRef = useRef<TrackNodes>({});
  
  const toneRef = useRef<ToneModule | null>(null);
  const eqNodesRef = useRef<import('tone').Filter[]>([]);
  const masterMeterRef = useRef<import('tone').Meter | null>(null);
  const masterVolumeNodeRef = useRef<import('tone').Volume | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState<Set<string>>(new Set());
  const [isSongLoading, setIsSongLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [masterVolume, setMasterVolume] = useState(100);

  const [volumes, setVolumes] = useState<{ [key: string]: number }>({});
  const [vuLevels, setVuLevels] = useState<Record<string, number>>({});
  const [masterVuLevel, setMasterVuLevel] = useState(-Infinity);
  
  const [eqBandCount, setEqBandCount] = useState<EqBandCount>(5);
  const [eqBands, setEqBands] = useState<number[]>(new Array(5).fill(50));
  
  const { toast } = useToast();
  
  const [localTrackNames, setLocalTrackNames] = useState<Record<string, string>>({});
  const [activeTracks, setActiveTracks] = useState<SetlistSong[]>([]);

  const rebuildEqChain = useCallback(async (bandCount: EqBandCount) => {
      const Tone = toneRef.current;
      if (!Tone || !masterVolumeNodeRef.current || !masterMeterRef.current) return;

      // Disconnect and dispose old filters
      eqNodesRef.current.forEach(filter => {
          filter.disconnect();
          filter.dispose();
      });
      eqNodesRef.current = [];

      // Create new filters
      const newFrequencies = FREQ_PRESETS[bandCount];
      const newEqChain = newFrequencies.map(freq => new Tone.Filter(freq, 'peaking', { Q: 1.5 }));
      
      // Reconnect the master chain
      Tone.connectSeries(...newEqChain, masterVolumeNodeRef.current);
      
      eqNodesRef.current = newEqChain;

      // Reconnect all track pitchShifts to the new EQ chain's input
      Object.values(trackNodesRef.current).forEach(node => {
        node.pitchShift.disconnect();
        node.pitchShift.connect(newEqChain[0]);
      });

      console.log(`Rebuilt EQ chain with ${bandCount} bands.`);
  }, []);

  const handleBandCountChange = useCallback((newCount: EqBandCount) => {
    if (newCount === eqBandCount) return;
    setEqBandCount(newCount);
    setEqBands(new Array(newCount).fill(50)); // Reset bands to flat
    rebuildEqChain(newCount);
  }, [eqBandCount, rebuildEqChain]);

  const initAudio = useCallback(async () => {
    if (!toneRef.current) {
        const Tone = await import('tone');
        toneRef.current = Tone;
    }
    if (!audioContextStarted.current && toneRef.current) {
        await toneRef.current.start();
        audioContextStarted.current = true;
        
        const Tone = toneRef.current;
        const masterVol = new Tone.Volume();
        const masterMeter = new Tone.Meter();
        masterVolumeNodeRef.current = masterVol;
        masterMeterRef.current = masterMeter;
        
        // Connect master volume to meter and destination
        masterVol.chain(masterMeter, Tone.Destination);

        // Build initial EQ chain
        await rebuildEqChain(eqBandCount);
    }
  }, [rebuildEqChain, eqBandCount]);


  useEffect(() => {
    const Tone = toneRef.current;
    if (!Tone || !masterVolumeNodeRef.current) return;
    const newDb = masterVolume > 0 ? (masterVolume / 100) * 40 - 40 : -Infinity;
    masterVolumeNodeRef.current.volume.value = newDb;
  }, [masterVolume]);

  const handleEqReset = useCallback(() => {
    setEqBands(new Array(eqBandCount).fill(50));
  }, [eqBandCount]);

  useEffect(() => {
    if (!toneRef.current || eqNodesRef.current.length === 0) return;
    eqNodesRef.current.forEach((filter, i) => {
      if (eqBands[i] === undefined) return;
      const gainValue = (eqBands[i] / 100) * (MAX_EQ_GAIN * 2) - MAX_EQ_GAIN;
      filter.gain.value = gainValue;
    });
  }, [eqBands]);

  // ... (el resto de los hooks y funciones sin cambios significativos)
  
  const stopAllTracks = useCallback(() => {
    const Tone = toneRef.current;
    if (!Tone) return;
    Tone.Transport.stop();
    Object.values(trackNodesRef.current).forEach(node => {
      if (node.player.state === 'started') node.player.stop();
      node.player.unsync();
    });
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);
  
  const handleSongSelected = useCallback(async (songId: string) => {
    if (songId === activeSongId) return;
    stopAllTracks();
    setActiveSongId(songId);
    setPlaybackRate(1);
    setPitch(0);
    setDuration(0);

    await initAudio();
    const Tone = toneRef.current;
    if (!Tone || eqNodesRef.current.length === 0) return;

    const tracksForSong = tracks.filter(t => t.songId === songId);
    
    const loadPromises = tracksForSong.map(async (track) => {
      if (trackNodesRef.current[track.id]) return;
      
      setLoadingTracks(prev => new Set(prev.add(track.fileKey)));
      
      try {
        const streamUrl = `/api/download-stream?fileKey=${track.fileKey}`;
        let audioBuffer: ArrayBuffer | null = await getCachedArrayBuffer(streamUrl);

        if (!audioBuffer) {
          const response = await fetch(streamUrl);
          if (!response.ok) throw new Error(`Fallo al cargar ${track.name}`);
          audioBuffer = await response.arrayBuffer();
          await cacheArrayBuffer(streamUrl, audioBuffer);
        }
        
        const player = new Tone.Player();
        const blob = new Blob([audioBuffer], { type: 'audio/wav' });
        const blobUrl = URL.createObjectURL(blob);
        await player.load(blobUrl);

        player.loop = false;

        const volume = new Tone.Volume(0);
        const pitchShift = new Tone.PitchShift({ pitch: 0 });
        const panner = new Tone.Panner(0);
        const waveform = new Tone.Waveform(256);
        
        // Conexión principal de la pista
        player.chain(volume, panner, pitchShift);
        
        // Conectar al inicio de la cadena de EQ
        if(eqNodesRef.current.length > 0) {
            pitchShift.connect(eqNodesRef.current[0]);
        }

        volume.connect(waveform); // Para el medidor VU
        
        trackNodesRef.current[track.id] = { player, panner, pitchShift, volume, waveform };

      } catch (e) {
        console.error(`Error procesando la pista ${track.name}:`, e);
      } finally {
        setLoadingTracks(prev => {
          const newSet = new Set(prev);
          newSet.delete(track.fileKey);
          return newSet;
        });
      }
    });
    
    await Promise.all(loadPromises);

    let finalMaxDuration = 0;
    tracksForSong.forEach(track => {
      const player = trackNodesRef.current[track.id]?.player;
      if (player && player.loaded) {
        const playerDuration = player.buffer.duration;
        if (playerDuration > finalMaxDuration) finalMaxDuration = playerDuration;
      }
    });
    setDuration(finalMaxDuration);

  }, [activeSongId, stopAllTracks, initAudio, tracks, toast]);
  
  const handleEqChange = (bandIndex: number, newValue: number) => {
    setEqBands(prevBands => {
      const newBands = [...prevBands];
      newBands[bandIndex] = newValue;
      return newBands;
    });
  };

  // ... (El resto del componente sigue igual)
  // Asegúrate de que los props pasados a LyricsDisplay estén actualizados

  return (
    <>
    <div className="grid grid-cols-[1fr_384px] grid-rows-[auto_1fr] h-screen w-screen p-4 gap-4">
      <div className="col-span-2 row-start-1">
        <Header 
            isPlaying={isPlaying}
            isPreparingPlay={isSongLoading}
            onPlay={() => {}}
            onPause={() => {}}
            onStop={stopAllTracks}
            currentTime={currentTime}
            duration={duration}
            onSeek={() => {}}
            isReadyToPlay={!!activeSong && !isSongLoading}
            activeSong={activeSong}
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
            onBpmChange={() => {}}
            pitch={pitch}
            onPitchChange={setPitch}
            displayKey={transposeNote(activeSong?.key ?? 'C', pitch)}
            masterVolume={masterVolume}
            onMasterVolumeChange={setMasterVolume}
            masterVuLevel={masterVuLevel}
            user={user}
            onReorderTracks={() => {}}
        />
      </div>
      
      <main className="col-start-1 row-start-2 overflow-y-auto pr-2 no-scrollbar flex flex-col gap-4">
        <div className="h-28">
            <LyricsDisplay 
              lyrics={activeSong?.lyrics ?? null}
              youtubeUrl={activeSong?.youtubeUrl ?? null}
              onOpenYouTube={() => {}}
              onOpenTeleprompter={() => {}}
              eqBands={eqBands}
              onEqChange={handleEqChange}
              onReset={handleEqReset}
              bandCount={eqBandCount}
              onBandCountChange={handleBandCountChange}
              frequencies={FREQ_PRESETS[eqBandCount]}
            />
        </div>
        {activeSongId ? (
            <MixerGrid
              tracks={activeTracks}
              activeSong={activeSong}
              soloTracks={soloTracks}
              mutedTracks={mutedTracks}
              volumes={volumes}
              onMuteToggle={() => {}}
              onSoloToggle={() => {}}
              onVolumeChange={() => {}}
              isPlaying={isPlaying}
              vuLevels={vuLevels}
              localTrackNames={localTrackNames}
              onTrackNameChange={() => {}}
            />
        ) : (
          <div className="flex justify-center items-center h-full">
            <div className="text-center text-muted-foreground">
                <p className="mt-4">Selecciona o crea un setlist para empezar.</p>
            </div>
         </div>
        )}
      </main>

       <div className="col-start-2 row-start-2 flex flex-col gap-4">
        <SongList 
            initialSetlist={initialSetlist}
            activeSongId={activeSongId}
            onSetlistSelected={setInitialSetlist}
            onSongSelected={handleSongSelected}
            onSongsFetched={setSongs}
            onSongAddedToSetlist={() => {}}
            loadingTracks={loadingTracks}
        />
        <TonicPad />
      </div>

    </div>
    </>
  );
};

export default DawPage;
