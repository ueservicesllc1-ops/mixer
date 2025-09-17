
'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Slider } from './ui/slider';
import { getSamplesByGroup, Sample } from '@/actions/samples';
import { useToast } from './ui/use-toast';
import { Loader2 } from 'lucide-react';
import { getB2FileAsDataURI } from '@/actions/download';

const topRowKeys = ['X', 'B', 'C', 'D'];
const bottomRowKeys = ['1', '2', '3', '4'];

type ToneModule = typeof import('tone');
type PlayersRef = Record<string, import('tone').Player | null>;
type SamplesRef = Record<string, Sample>;

const TonicPad = () => {
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [activePad, setActivePad] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  const toneRef = useRef<ToneModule | null>(null);
  const audioPlayersRef = useRef<PlayersRef>({});
  const samplesRef = useRef<SamplesRef>({});
  const masterVolumeNodeRef = useRef<import('tone').Volume | null>(null);

  const initializeAudio = useCallback(async () => {
    if (!toneRef.current) {
        toneRef.current = await import('tone');
    }
    const Tone = toneRef.current;
    if (Tone.context.state === 'suspended') {
        await Tone.start();
    }
    if (!masterVolumeNodeRef.current) {
        masterVolumeNodeRef.current = new Tone.Volume().toDestination();
    }
  }, []);

  const loadSamplesForGroup = useCallback(async (groupKey: string) => {
    setIsLoading(true);
    await initializeAudio();
    const Tone = toneRef.current!;

    // Dispose old players and clear samples
    Object.values(audioPlayersRef.current).forEach(player => player?.dispose());
    audioPlayersRef.current = {};
    samplesRef.current = {};

    const { success, samples, error } = await getSamplesByGroup(groupKey);

    if (!success) {
      toast({ variant: 'destructive', title: 'Error cargando samples', description: error });
      setIsLoading(false);
      return;
    }

    if (!samples || samples.length === 0) {
      setIsLoading(false);
      return;
    }

    const loadPromises = samples.map(async (sample) => {
        if (!sample.url || !sample.padKey || !sample.fileKey) return;
        try {
            samplesRef.current[sample.padKey] = sample;
            const downloadResult = await getB2FileAsDataURI(sample.fileKey);

            if (!downloadResult.success || !downloadResult.dataUri) {
                throw new Error(downloadResult.error || `Failed to get data URI for ${sample.name}`);
            }
            
            const player = new Tone.Player(downloadResult.dataUri).connect(masterVolumeNodeRef.current!);
            audioPlayersRef.current[sample.padKey] = player;
        } catch (e) {
            console.error(`Error cargando el sample ${sample.name}:`, e);
            toast({ variant: 'destructive', title: 'Error de carga', description: `No se pudo cargar el sample "${sample.name}".`});
        }
    });

    await Promise.all(loadPromises);
    setIsLoading(false);
  }, [initializeAudio, toast]);

  useEffect(() => {
    if (selectedGroup) {
      loadSamplesForGroup(selectedGroup);
    } else {
       Object.values(audioPlayersRef.current).forEach(player => player?.dispose());
       audioPlayersRef.current = {};
       samplesRef.current = {};
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup]);
  
  useEffect(() => {
      if (masterVolumeNodeRef.current) {
          masterVolumeNodeRef.current.mute = isMuted;
      }
  }, [isMuted])

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (masterVolumeNodeRef.current) {
        const newDb = value[0] > 0 ? (value[0] / 100) * 20 - 20 : -Infinity;
        masterVolumeNodeRef.current.volume.value = newDb;
    }
  };
  
  const handleGroupSelect = (key: string) => {
    const newGroup = selectedGroup === key ? null : key;
    setSelectedGroup(newGroup);
    setActivePad(null); 
  }

  const playSound = (padKey: string) => {
   if (isLoading) return;

   const player = audioPlayersRef.current[padKey];
   if (player) {
       if (player.state === 'started') {
            player.stop();
            setActivePad(null);
       } else {
            player.start();
            setActivePad(padKey);
            player.onstop = () => {
                setActivePad(currentPad => currentPad === padKey ? null : currentPad);
            }
       }
   } else {
       toast({ title: "Sin sonido", description: `No hay un sample asignado al pad ${padKey}.`, variant: "destructive" });
   }
  };

  return (
    <div className="bg-card/50 rounded-lg p-3 flex flex-col gap-3">
        <div className="flex justify-between items-center">
            <h2 className="font-bold text-foreground">Sampler</h2>
        </div>
        <div className="grid grid-cols-4 gap-2">
            {topRowKeys.map((key) => (
                <Button 
                    key={key} 
                    variant={selectedGroup === key ? 'default' : 'secondary'}
                    className={cn(
                        "w-full h-8 text-sm font-bold",
                        selectedGroup === key 
                            ? "bg-yellow-500 text-black hover:bg-yellow-500/90" 
                            : "bg-secondary hover:bg-accent"
                    )}
                    onClick={() => handleGroupSelect(key)}
                >
                    {key}
                </Button>
            ))}
        </div>
      <div className="grid grid-cols-4 gap-2">
        {bottomRowKeys.map((key) => {
            const sampleName = samplesRef.current[key]?.name || '';
            const isPadActive = activePad === key;
            return (
                <div key={key} className="flex flex-col gap-1">
                    <div className={cn(
                        "bg-black/80 border border-amber-400/20 rounded-md h-8 flex items-center justify-center px-1 transition-all",
                        isPadActive && "border-amber-400 [box-shadow:0_0_8px_0px_theme(colors.amber.400)]"
                    )}>
                        <span className={cn(
                            "font-mono text-xs text-amber-400/60 uppercase truncate transition-all",
                            isPadActive && "text-amber-400 [text-shadow:0_0_8px_theme(colors.amber.400)]"
                        )}>
                            {isLoading && selectedGroup ? <Loader2 className="w-4 h-4 animate-spin"/> : (sampleName || '-')}
                        </span>
                    </div>
                    <Button 
                        variant="secondary"
                        className={cn(
                            "w-full h-20 text-lg font-bold transition-colors relative",
                            !selectedGroup && "opacity-50 cursor-not-allowed",
                            isPadActive
                                ? "bg-yellow-500 text-black hover:bg-yellow-500/90"
                                : "bg-secondary hover:bg-accent"
                        )}
                        onClick={() => playSound(key)}
                        disabled={!selectedGroup || isLoading}
                    >
                        {key}
                    </Button>
                </div>
            )
        })}
      </div>
      <div className="flex items-center gap-1.5 pt-2">
        <Slider
            defaultValue={[volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className={cn(
                '[&>span:first-child]:bg-secondary',
                '[&_.bg-primary]:bg-primary [&_.border-primary]:border-primary',
                 (isMuted) && 'opacity-50'
             )}
            disabled={isMuted}
        />
        <Button 
            variant={isMuted ? 'destructive' : 'secondary'}
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
                'w-10 h-8 text-xs font-bold'
            )}
        >
            MUTE
        </Button>
      </div>
    </div>
  );
};

export default TonicPad;
