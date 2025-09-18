
'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import MixerGrid from '@/components/MixerGrid';
import SongList from '@/components/SongList';
import TonicPad from '@/components/TonicPad';
import { getSetlists, Setlist, SetlistSong } from '@/actions/setlists';
import { Song, TrackFile } from '@/actions/songs';
import { SongStructure } from '@/ai/flows/song-structure';
import LyricsDisplay from '@/components/LyricsDisplay';
import YouTubePlayerDialog from '@/components/YouTubePlayerDialog';
import type { LyricsSyncOutput } from '@/ai/flows/lyrics-synchronization';
import TeleprompterDialog from '@/components/TeleprompterDialog';
import { useToast } from '@/components/ui/use-toast';
import { useB2Connection } from '@/contexts/B2ConnectionContext';

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


  const [loadingTracks, setLoadingTracks] = useState(new Set<string>());
  
  const [isPlaying, setIsPlaying] = useState(false);
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

  const [isOnline, setIsOnline] = useState(true);
  const { toast } = useToast();
  const { setStatus, startTimer, stopTimer } = useB2Connection();

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      setIsOnline(window.navigator.onLine);
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
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

  useEffect(() => {
    const fetchLastSetlist = async () => {
      const userId = 'user_placeholder_id';
      const result = await getSetlists(userId);
      if (result.success && result.setlists && result.setlists.length > 0) {
        setInitialSetlist(result.setlists[0]);
      }
    };
    fetchLastSetlist();
  }, []);
  
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

  const handleSongSelected = useCallback((songId: string) => {
      if (songId === activeSongId) return;
      stopAllTracks();
      setActiveSongId(songId);
      setPlaybackRate(1);
      setPitch(0);
      setDuration(0);
  }, [activeSongId, stopAllTracks]);

  useEffect(() => {
    if (initialSetlist && initialSetlist.songs) {
      setTracks(initialSetlist.songs);
      if (initialSetlist.songs.length > 0) {
        const firstSongId = initialSetlist.songs[0].songId;
        if (firstSongId && firstSongId !== activeSongId) {
            handleSongSelected(firstSongId);
        }
      } else {
        handleSongSelected('');
      }
    } else {
      handleSongSelected('');
    }
  }, [initialSetlist, handleSongSelected, activeSongId]);

  useEffect(() => {
        const prepareAudioNodes = async () => {
            if (!activeSongId) {
                stopAllTracks();
                setDuration(0);
                return;
            }

            await initAudio();
            const Tone = toneRef.current;
            if (!Tone || eqNodesRef.current.length === 0) return;

            Object.values(trackNodesRef.current).forEach(node => {
                node.player.dispose();
                node.panner.dispose();
                node.pitchShift.dispose();
                node.volume.dispose();
                node.waveform.dispose();
            });
            trackNodesRef.current = {};
            
            const tracksForSong = tracks.filter(t => t.songId === activeSongId);
            if(tracksForSong.length === 0) return;
            
            const newLoadingSet = new Set<string>();
            tracksForSong.forEach(t => newLoadingSet.add(t.id));
            setLoadingTracks(newLoadingSet);
            startTimer();

            const loadPromises = tracksForSong.map(async (track) => {
              try {
                // Point to our new streaming endpoint
                const streamingUrl = `/api/download-stream?fileKey=${encodeURIComponent(track.fileKey)}`;
                
                const player = new Tone.Player(streamingUrl);
                player.loop = true;

                const volume = new Tone.Volume(0);
                const pitchShift = new Tone.PitchShift({ pitch: pitch });
                const panner = new Tone.Panner(0);
                const waveform = new Tone.Waveform(256);
                
                player.chain(volume, panner, pitchShift, waveform);
                pitchShift.connect(eqNodesRef.current[0]);

                trackNodesRef.current[track.id] = { player, panner, pitchShift, volume, waveform };
                
                await Tone.loaded();

                setLoadingTracks(prev => {
                  const next = new Set(prev);
                  next.delete(track.id);
                  return next;
                });

              } catch(e) {
                console.error(`Error processing track ${track.name}:`, e);
                toast({
                    variant: "destructive",
                    title: 'Error de Carga de Pista',
                    description: `No se pudo cargar la pista "${track.name}".`
                });
                setLoadingTracks(prev => {
                  const next = new Set(prev);
                  next.delete(track.id);
                  return next;
                });
              }
            });

            await Promise.allSettled(loadPromises);
        };

        prepareAudioNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSongId, isOnline]);
    
  useEffect(() => {
    if (loadingTracks.size === 0) {
      const hasTracks = tracks.filter(t => t.songId === activeSongId).length > 0;
      if (hasTracks) {
        const maxDuration = Math.max(0, ...Object.values(trackNodesRef.current).map(node => node.player.buffer.duration));
        setDuration(maxDuration);
        setStatus('success');
        stopTimer();
      } else {
        setDuration(0);
        setStatus('idle');
        stopTimer();
      }
    } else {
        setStatus('in-progress');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingTracks, activeSongId, songs]);

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
      if (!Tone || !activeSong?.id) return;
      
      const songToUse = songs.find(s => s.id === activeSong.id);
      if (!songToUse) return;

      Object.values(trackNodesRef.current).forEach(({ player }) => {
        if (player) player.playbackRate = playbackRate;
      });
      Tone.Transport.bpm.value = songToUse.tempo * playbackRate;
  }, [playbackRate, activeSong, songs]);

  const handlePlay = useCallback(async () => {
    const Tone = toneRef.current;
    if (!Tone || loadingTracks.size > 0 || !activeSongId) return;
    await initAudio();
    if (Tone.context.state === 'suspended') await Tone.context.resume();
    if (Tone.Transport.state !== 'started') {
      Object.values(trackNodesRef.current).forEach(node => node.player?.unsync());
      activeTracksRef.current.forEach(track => {
          const trackNode = trackNodesRef.current[track.id];
          if (trackNode) {
              trackNode.player.sync().start(0);
          }
      });
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [loadingTracks.size, activeSongId, initAudio]);

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
  
  const totalTracksForCurrentSong = useMemo(() => tracks.filter(t => t.songId === activeSongId).length, [tracks, activeSongId]);
  const loadingProgress = totalTracksForCurrentSong > 0 ? ((totalTracksForCurrentSong - loadingTracks.size) / totalTracksForCurrentSong) * 100 : 100;
  const showLoadingBar = loadingTracks.size > 0;

  return (
    <div className="grid grid-cols-[1fr_384px] grid-rows-[auto_1fr] h-screen w-screen p-4 gap-4">
      <div className="col-span-2 row-start-1">
        <Header 
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={stopAllTracks}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            isReadyToPlay={loadingTracks.size === 0 && !!activeSong}
            loadingProgress={loadingProgress}
            showLoadingBar={showLoadingBar}
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
            masterVolume={masterVolume}
            onMasterVolumeChange={handleMasterVolumeChange}
            masterVuLevel={masterVuLevel}
            isOnline={isOnline}
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
              isOnline={isOnline}
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
            isOnline={isOnline}
        />
        <TonicPad isOnline={isOnline} />
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
  );
};

export default DawPage;
