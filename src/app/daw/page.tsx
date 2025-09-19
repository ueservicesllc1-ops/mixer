
'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import MixerGrid from '@/components/MixerGrid';
import SongList from '@/components/SongList';
import TonicPad from '@/components/TonicPad';
import { getSetlists, Setlist, SetlistSong } from '@/actions/setlists';
import { Song } from '@/actions/songs';
import { SongStructure } from '@/ai/flows/song-structure';
import LyricsDisplay from '@/components/LyricsDisplay';
import YouTubePlayerDialog from '@/components/YouTubePlayerDialog';
import type { LyricsSyncOutput } from '@/ai/flows/lyrics-synchronization';
import TeleprompterDialog from '@/components/TeleprompterDialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { transposeNote } from '@/lib/utils';
import { getCachedArrayBuffer, cacheArrayBuffer } from '@/lib/audiocache';

const eqFrequencies = [60, 250, 1000, 4000, 8000];
const MAX_EQ_GAIN = 12;

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
  const [songStructure, setSongStructure] = useState<SongStructure | null>(null);
  const [songLyrics, setSongLyrics] = useState<string | null>(null);
  const [songSyncedLyrics, setSongSyncedLyrics] = useState<LyricsSyncOutput | null>(null);
  const [songYoutubeUrl, setSongYoutubeUrl] = useState<string | null>(null);
  const [songSyncOffset, setSongSyncOffset] = useState<number>(0);
  const [duration, setDuration] = useState(0);

  const activeSong = useMemo(() => songs.find(s => s.id === activeSongId), [songs, activeSongId]);
  const audioContextStarted = useRef(false);
  const trackNodesRef = useRef<TrackNodes>({});
  
  const toneRef = useRef<ToneModule | null>(null);
  const eqNodesRef = useRef<import('tone').Filter[]>([]);
  const masterMeterRef = useRef<import('tone').Meter | null>(null);
  const masterVolumeNodeRef = useRef<import('tone').Volume | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState<Set<string>>(new Set()); // Tracks currently being downloaded
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [masterVolume, setMasterVolume] = useState(100);

  const [volumes, setVolumes] = useState<{ [key: string]: number }>({});
  const [vuLevels, setVuLevels] = useState<Record<string, number>>({});
  const [masterVuLevel, setMasterVuLevel] = useState(-Infinity);
  const [eqBands, setEqBands] = useState([50, 50, 50, 50, 50]);
  const [fadeOutDuration, setFadeOutDuration] = useState(0.5);
  const [isPanVisible, setIsPanVisible] = useState(false);
  
  const [isYouTubePlayerOpen, setIsYouTubePlayerOpen] = useState(false);
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);

  const { toast } = useToast();
  
  const [localTrackNames, setLocalTrackNames] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const storedNames = localStorage.getItem('localTrackNames');
      if (storedNames) {
        setLocalTrackNames(JSON.parse(storedNames));
      }
    } catch (error) {
      console.error("Failed to load local track names from localStorage", error);
    }
  }, []);

  const handleTrackNameChange = (trackId: string, newName: string) => {
    const newLocalNames = { ...localTrackNames, [trackId]: newName };
    setLocalTrackNames(newLocalNames);
    try {
      localStorage.setItem('localTrackNames', JSON.stringify(newLocalNames));
    } catch (error) {
      console.error("Failed to save local track names to localStorage", error);
    }
  };


  const initAudio = useCallback(async () => {
    if (!toneRef.current) {
        const Tone = await import('tone');
        toneRef.current = Tone;
    }
    if (!audioContextStarted.current && toneRef.current) {
        await toneRef.current.start();
        audioContextStarted.current = true;
        console.log("Audio context started with Tone.js");

        if (eqNodesRef.current.length === 0) {
            const Tone = toneRef.current;
            const eqChain = eqFrequencies.map((freq) => {
                return new Tone.Filter(freq, 'peaking', { Q: 1.5 });
            });
            const masterVol = new Tone.Volume();
            const masterMeter = new Tone.Meter();
            
            Tone.connectSeries(...eqChain, masterVol, masterMeter, Tone.Destination);
            
            eqNodesRef.current = eqChain;
            masterVolumeNodeRef.current = masterVol;
            masterMeterRef.current = masterMeter;
        }
    }
  }, []);

  useEffect(() => {
    initAudio();
  }, [initAudio]);

  useEffect(() => {
    const Tone = toneRef.current;
    if (!Tone || !masterVolumeNodeRef.current) return;
    const newDb = masterVolume > 0 ? (masterVolume / 100) * 40 - 40 : -Infinity;
    masterVolumeNodeRef.current.volume.value = newDb;
  }, [masterVolume]);

  const handleEqReset = () => setEqBands([50, 50, 50, 50, 50]);

  useEffect(() => {
    if (!toneRef.current || eqNodesRef.current.length === 0) return;
    eqNodesRef.current.forEach((filter, i) => {
      const gainValue = (eqBands[i] / 100) * (MAX_EQ_GAIN * 2) - MAX_EQ_GAIN;
      filter.gain.value = gainValue;
    });
  }, [eqBands]);

  const activeTracks = useMemo(() => {
    const getPrio = (trackName: string) => {
      const upperCaseName = trackName.trim().toUpperCase();
      if (upperCaseName === 'CLICK') return 1;
      if (upperCaseName === 'CUES') return 2;
      return 3;
    };
    return tracks
      .filter(t => t.songId === activeSongId)
      .sort((a, b) => {
          const prioA = getPrio(a.name);
          const prioB = getPrio(b.name);
          if (prioA !== prioB) return prioA - prioB;
          return a.name.localeCompare(b.name);
      });
  }, [tracks, activeSongId]);


  const activeTracksRef = useRef(activeTracks);
  useEffect(() => {
      activeTracksRef.current = activeTracks;
  }, [activeTracks]);

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

  useEffect(() => {
    const fetchLastSetlist = async () => {
      if (!user) return;
      const result = await getSetlists(user.uid);
      if (result.success && result.setlists && result.setlists.length > 0) {
        setInitialSetlist(result.setlists[0]);
      }
    };
    if (user) {
        fetchLastSetlist();
    }
  }, [user]);

  const isSongLoading = useMemo(() => {
    if (!activeSongId) return false;
    const tracksForSong = tracks.filter(t => t.songId === activeSongId);
    return tracksForSong.some(t => loadingTracks.has(t.fileKey));
  }, [activeSongId, tracks, loadingTracks]);
  
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
    let maxDuration = 0;

    const loadTrack = async (track: SetlistSong) => {
        if (trackNodesRef.current[track.id] || loadingTracks.has(track.fileKey)) {
            if(trackNodesRef.current[track.id]) {
                const playerDuration = trackNodesRef.current[track.id].player.buffer.duration;
                if (playerDuration > maxDuration) maxDuration = playerDuration;
            }
            return;
        }

        setLoadingTracks(prev => new Set(prev.add(track.fileKey)));

        try {
            const streamUrl = `/api/download-stream?fileKey=${track.fileKey}`;
            
            // Hybrid Caching Logic
            let audioBuffer: ArrayBuffer | null = await getCachedArrayBuffer(streamUrl);
            
            if (!audioBuffer) {
                const response = await fetch(streamUrl);
                if (!response.ok) throw new Error(`Failed to fetch ${track.name}`);
                audioBuffer = await response.arrayBuffer();
                await cacheArrayBuffer(streamUrl, audioBuffer);
            }
            
            const player = new Tone.Player().toDestination();
            await player.load(streamUrl);
            
            const playerDuration = player.buffer.duration;
            if (playerDuration > maxDuration) maxDuration = playerDuration;
            player.loop = true;

            const volume = new Tone.Volume(0);
            const pitchShift = new Tone.PitchShift({ pitch: 0 });
            const panner = new Tone.Panner(0);
            const waveform = new Tone.Waveform(256);
            
            player.chain(volume, panner, pitchShift);
            pitchShift.connect(eqNodesRef.current[0]);
            volume.connect(waveform);

            trackNodesRef.current[track.id] = { player, panner, pitchShift, volume, waveform };

        } catch (e) {
            console.error(`Error processing track ${track.name}:`, e);
            toast({
                variant: "destructive",
                title: 'Error de Carga de Pista',
                description: `No se pudo cargar la pista "${track.name}". El archivo podría estar corrupto o no ser accesible.`
            });
        } finally {
            setLoadingTracks(prev => {
                const newSet = new Set(prev);
                newSet.delete(track.fileKey);
                return newSet;
            });
            // This is a bit tricky, we'll update duration at the end
        }
    };

    await Promise.all(tracksForSong.map(loadTrack));

    // After all tracks are attempted, find the max duration
    let finalMaxDuration = 0;
    tracksForSong.forEach(track => {
        const player = trackNodesRef.current[track.id]?.player;
        if (player && player.loaded) {
            const playerDuration = player.buffer.duration;
            if (playerDuration > finalMaxDuration) finalMaxDuration = playerDuration;
        }
    });
    setDuration(finalMaxDuration);


  }, [activeSongId, stopAllTracks, initAudio, tracks, loadingTracks, toast]);

  useEffect(() => {
    if (initialSetlist && initialSetlist.songs) {
        setTracks(initialSetlist.songs);
    }
  }, [initialSetlist]);

  // Cleanup on unmount
  useEffect(() => {
    const nodes = trackNodesRef.current;
    return () => {
        Object.values(nodes).forEach(node => {
            if (node.player) node.player.dispose();
            if (node.panner) node.panner.dispose();
            if (node.pitchShift) node.pitchShift.dispose();
            if (node.volume) node.volume.dispose();
            if (node.waveform) node.waveform.dispose();
        });
        trackNodesRef.current = {};
    }
  }, []);

  // Set duration for the active song
  useEffect(() => {
    if (!activeSongId) {
        setDuration(0);
        return;
    }
    const tracksForSong = tracks.filter(t => t.songId === activeSongId);
    let maxDuration = 0;
    
    const allTracksLoaded = tracksForSong.every(track => trackNodesRef.current[track.id]?.player.loaded);
    
    if (allTracksLoaded) {
      tracksForSong.forEach(track => {
        const player = trackNodesRef.current[track.id]?.player;
        if (player) {
          const playerDuration = player.buffer.duration;
          if (playerDuration > maxDuration) maxDuration = playerDuration;
        }
      });
      setDuration(maxDuration);
    }

  }, [activeSongId, tracks, loadingTracks]); // Re-evaluate duration when loading finishes

  useEffect(() => {
    if (activeSongId) {
        const currentSong = songs.find(s => s.id === activeSongId);
        setSongStructure(currentSong?.structure || null);
        setSongLyrics(currentSong?.lyrics || null);
        setSongSyncedLyrics(currentSong?.syncedLyrics || null);
        setSongYoutubeUrl(currentSong?.youtubeUrl || null);
        setSongSyncOffset(currentSong?.syncOffset || 0);
    } else {
        setSongStructure(null);
        setSongLyrics(null);
        setSongSyncedLyrics(null);
        setSongYoutubeUrl(null);
        setSongSyncOffset(0);
    }
  }, [activeSongId, songs]);

  useEffect(() => {
    const newVolumes: { [key: string]: number } = {};
    activeTracks.forEach(track => {
      newVolumes[track.id] = volumes[track.id] ?? 100;
    });
    setVolumes(newVolumes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTracks]);

  useEffect(() => {
    let animationFrameId: number;
    const Tone = toneRef.current;
    if (isPlaying && Tone) {
        const update = () => {
            setCurrentTime(Tone.Transport.seconds);
            const newVuLevels: Record<string, number> = {};
            activeTracksRef.current.forEach(track => {
                const node = trackNodesRef.current[track.id];
                if (node && node.waveform) {
                    const values = node.waveform.getValue();
                    let peak = 0;
                    if (values instanceof Float32Array) {
                        for (let i = 0; i < values.length; i++) {
                            const absValue = Math.abs(values[i]);
                            if (absValue > peak) peak = absValue;
                        }
                    }
                    newVuLevels[track.id] = 20 * Math.log10(peak);
                }
            });
            setVuLevels(newVuLevels);
            if (masterMeterRef.current) setMasterVuLevel(masterMeterRef.current.getValue() as number);
            animationFrameId = requestAnimationFrame(update);
        };
        update();
    } else {
        const decay = () => {
            setVuLevels(prevLevels => {
                const newLevels: Record<string, number> = {};
                let hasActiveLevels = false;
                for (const trackId in prevLevels) {
                    const currentLevel = prevLevels[trackId];
                    if (currentLevel > -60) {
                        newLevels[trackId] = currentLevel - 2;
                        hasActiveLevels = true;
                    } else {
                        newLevels[trackId] = -Infinity;
                    }
                }
                if (hasActiveLevels) animationFrameId = requestAnimationFrame(decay);
                return newLevels;
            });
            setMasterVuLevel(prev => prev > -60 ? prev - 2 : -Infinity);
        };
        decay();
    }
    return () => { if (animationFrameId) cancelAnimationFrame(animationFrameId); };
}, [isPlaying]);

  const getIsMuted = useCallback((trackId: string) => {
    const isMuted = mutedTracks.includes(trackId);
    const isSoloActive = soloTracks.length > 0;
    const isThisTrackSolo = soloTracks.includes(trackId);
    if (isMuted) return true;
    if (isSoloActive) return !isThisTrackSolo;
    return false;
  }, [mutedTracks, soloTracks]);

  useEffect(() => {
    Object.keys(trackNodesRef.current).forEach(trackId => {
        const node = trackNodesRef.current[trackId];
        if (node?.volume) node.volume.mute = getIsMuted(trackId);
        if (node?.pitchShift) node.pitchShift.pitch = pitch;
    });
  }, [mutedTracks, soloTracks, getIsMuted, pitch]);
  
   useEffect(() => {
      const Tone = toneRef.current;
      if (!Tone || !activeSong) return;

      Object.values(trackNodesRef.current).forEach(({ player }) => {
        if (player) player.playbackRate = playbackRate;
      });
      Tone.Transport.bpm.value = activeSong.tempo * playbackRate;
  }, [playbackRate, activeSong]);

  const handlePlay = useCallback(async () => {
    const Tone = toneRef.current;
    if (!Tone || !activeSongId) return;
    
    await initAudio();
    if (Tone.context.state === 'suspended') await Tone.context.resume();
    
    try {
        const tracksForSong = activeTracksRef.current;
        const allPlayersReady = tracksForSong.every(t => trackNodesRef.current[t.id]?.player.loaded);

        if (!allPlayersReady) {
            toast({ variant: "destructive", title: "Pistas no listas", description: "Algunas pistas todavía se están cargando. Por favor, espere." });
            return;
        }

        if (Tone.Transport.state !== 'started') {
          Object.values(trackNodesRef.current).forEach(node => node.player?.unsync());
          tracksForSong.forEach(track => {
              const trackNode = trackNodesRef.current[track.id];
              if (trackNode && trackNode.player.loaded) {
                  trackNode.player.sync().start(0);
              }
          });
          Tone.Transport.start();
          setIsPlaying(true);
        }
    } catch(err) {
        console.error("Error during playback preparation:", err);
        toast({ variant: "destructive", title: "Error de Reproducción", description: "No se pudieron cargar todas las pistas." });
    }
  }, [activeSongId, initAudio, toast]);

  const handlePause = useCallback(() => {
    const Tone = toneRef.current;
    if (!Tone) return;
    Tone.Transport.pause();
    setIsPlaying(false);
  }, []);

  const handleMuteToggle = (trackId: string) => {
    setMutedTracks(prev => prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]);
    if (!mutedTracks.includes(trackId)) setSoloTracks(prev => prev.filter(id => id !== trackId));
  };

  const handleSoloToggle = (trackId: string) => {
    setSoloTracks(prev => prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]);
  };
  
  const handleSetlistSelected = (setlist: Setlist | null) => {
    setInitialSetlist(setlist);
    if (!setlist) {
        stopAllTracks();
        setTracks([]);
        setActiveSongId(null);
    }
  };
  
  const handleVolumeChange = useCallback((trackId: string, newVol: number) => {
    setVolumes(prev => ({...prev, [trackId]: newVol}));
    const node = trackNodesRef.current[trackId];
    if (node && node.volume) {
      const newDb = newVol > 0 ? (newVol / 100) * 40 - 40 : -Infinity;
      node.volume.volume.value = newDb;
    }
  }, []);

  const handleMasterVolumeChange = (newVol: number) => setMasterVolume(newVol);
  
  const handleEqChange = (bandIndex: number, newValue: number) => {
    setEqBands(prevBands => {
      const newBands = [...prevBands];
      newBands[bandIndex] = newValue;
      return newBands;
    });
  };

  const handleBpmChange = (newBpm: number) => {
      if (!activeSong || !activeSong.tempo) return;
      const newRate = newBpm / activeSong.tempo;
      setPlaybackRate(Math.max(0.5, Math.min(2, newRate)));
  };
  
  const handleSeek = (newTime: number) => {
    const Tone = toneRef.current;
    if (!Tone || !activeSong) return;
    Tone.Transport.seconds = newTime;
    setCurrentTime(newTime);
  };
  
  const displayKey = activeSong?.key ? transposeNote(activeSong.key, pitch) : '-';


  return (
    <>
    <div className="grid grid-cols-[1fr_384px] grid-rows-[auto_1fr] h-screen w-screen p-4 gap-4">
      <div className="col-span-2 row-start-1">
        <Header 
            isPlaying={isPlaying}
            isPreparingPlay={isSongLoading}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={stopAllTracks}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            isReadyToPlay={!!activeSong && !isSongLoading}
            fadeOutDuration={fadeOutDuration}
            onFadeOutDurationChange={setFadeOutDuration}
            isPanVisible={isPanVisible}
            onPanVisibilityChange={setIsPanVisible}
            activeSong={activeSong}
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
            onBpmChange={handleBpmChange}
            pitch={pitch}
            onPitchChange={setPitch}
            displayKey={displayKey}
            masterVolume={masterVolume}
            onMasterVolumeChange={handleMasterVolumeChange}
            masterVuLevel={masterVuLevel}
            user={user}
        />
      </div>
      
      <main className="col-start-1 row-start-2 overflow-y-auto pr-2 no-scrollbar flex flex-col gap-4">
        <div className="h-28">
            <LyricsDisplay 
              lyrics={songLyrics}
              youtubeUrl={songYoutubeUrl}
              onOpenYouTube={() => setIsYouTubePlayerOpen(true)}
              onOpenTeleprompter={() => setIsTeleprompterOpen(true)}
              eqBands={eqBands}
              onEqChange={handleEqChange}
              onReset={handleEqReset}
            />
        </div>
        {activeSongId ? (
            <MixerGrid
              tracks={activeTracks}
              activeSong={activeSong}
              soloTracks={soloTracks}
              mutedTracks={mutedTracks}
              volumes={volumes}
              onMuteToggle={handleMuteToggle}
              onSoloToggle={handleSoloToggle}
              onVolumeChange={handleVolumeChange}
              isPlaying={isPlaying}
              vuLevels={vuLevels}
              localTrackNames={localTrackNames}
              onTrackNameChange={handleTrackNameChange}
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
            onSetlistSelected={handleSetlistSelected}
            onSongSelected={handleSongSelected}
            onSongsFetched={setSongs}
            onSongAddedToSetlist={() => {}}
            loadingTracks={loadingTracks}
        />
        <TonicPad />
      </div>

      <YouTubePlayerDialog
        isOpen={isYouTubePlayerOpen}
        onClose={() => setIsYouTubePlayerOpen(false)}
        videoUrl={songYoutubeUrl}
        songTitle={activeSong?.name || 'Video de YouTube'}
       />
       <TeleprompterDialog
        isOpen={isTeleprompterOpen}
        onClose={() => setIsTeleprompterOpen(false)}
        songTitle={activeSong?.name || 'Teleprompter'}
        lyrics={songLyrics}
      />
    </div>
    </>
  );
};

export default DawPage;
