
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, AudioLines, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getSamplesByGroup, saveSample, Sample } from '@/actions/samples';
import { useToast } from './ui/use-toast';
import { uploadFileToB2 } from '@/actions/upload';
import { Progress } from './ui/progress';

const topRowKeys = ['X', 'B', 'C', 'D'];
const bottomRowKeys = ['1', '2', '3', '4'];

type PadStatus = 'idle' | 'uploading' | 'saving' | 'success' | 'error';

interface PadState {
    status: PadStatus;
    progress: number;
    error?: string;
    sample: Partial<Sample> | null;
}

const SamplerPadSettings = () => {
    const [selectedGroup, setSelectedGroup] = useState<string>('X');
    const [isLoading, setIsLoading] = useState(false);
    const [pads, setPads] = useState<Record<string, PadState>>({});
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const { toast } = useToast();
    
    useEffect(() => {
        const initialPads: Record<string, PadState> = {};
        bottomRowKeys.forEach(padKey => {
            initialPads[padKey] = { status: 'idle', progress: 0, sample: null };
        });
        setPads(initialPads);
        fetchSamplesForGroup(selectedGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroup]);

    const fetchSamplesForGroup = async (groupKey: string) => {
        setIsLoading(true);
        try {
            const result = await getSamplesByGroup(groupKey);
            if (result.success && result.samples) {
                setPads(prevPads => {
                    const newPads = { ...prevPads };
                    // Reset all pads first
                    bottomRowKeys.forEach(padKey => {
                         newPads[padKey] = { status: 'idle', progress: 0, sample: null };
                    });
                    // Then fill with fetched samples
                    result.samples?.forEach(sample => {
                        if (newPads[sample.padKey]) {
                            newPads[sample.padKey].sample = sample;
                        }
                    });
                    return newPads;
                });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleNameChange = (padKey: string, newName: string) => {
        setPads(prev => {
            const currentPad = prev[padKey];
            const newSample = currentPad.sample
                ? { ...currentPad.sample, name: newName }
                : { name: newName, groupKey: selectedGroup, padKey: padKey };
    
            return {
                ...prev,
                [padKey]: {
                    ...currentPad,
                    sample: newSample
                }
            };
        });
    };

    const handleNameBlur = async (padKey: string) => {
        const padState = pads[padKey];
        // Guardar solo si existe un ID (es un sample ya guardado) y tiene un nombre
        if (!padState.sample || !padState.sample.id || !padState.sample.name) return;

        try {
            await saveSample(padState.sample as Sample);
            toast({ title: "Nombre actualizado", description: `Se guardó el nombre para el Pad ${padKey}.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };
    
    const handleFileSelect = (padKey: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Por favor, selecciona un archivo de audio (MP3, WAV, etc.).' });
            return;
        }
        
        uploadFile(padKey, file);
    };
    
    const uploadFile = async (padKey: string, file: File) => {
        setPads(prev => ({ ...prev, [padKey]: { ...prev[padKey], status: 'uploading', progress: 0 } }));
        
        try {
            const uploadResult = await uploadFileToB2(file);
            if (!uploadResult.success || !uploadResult.url || !uploadResult.fileKey) {
                throw new Error(uploadResult.error || 'Error al subir el archivo.');
            }

            setPads(prev => ({ ...prev, [padKey]: { ...prev[padKey], status: 'saving' } }));

            const currentSample = pads[padKey]?.sample;
            const sampleData: Sample = {
                id: currentSample?.id,
                groupKey: selectedGroup,
                padKey: padKey,
                name: currentSample?.name || file.name.split('.').slice(0, -1).join('.'),
                url: uploadResult.url,
                fileKey: uploadResult.fileKey,
            };

            const saveResult = await saveSample(sampleData);

            if (saveResult.success && saveResult.sample) {
                setPads(prev => ({
                    ...prev,
                    [padKey]: { ...prev[padKey], status: 'success', sample: saveResult.sample }
                }));
                toast({ title: '¡Éxito!', description: `Sonido asignado al Pad ${padKey}.` });
            } else {
                throw new Error(saveResult.error || 'No se pudo guardar la configuración del sample.');
            }

        } catch (error) {
            setPads(prev => ({ ...prev, [padKey]: { ...prev[padKey], status: 'error', error: (error as Error).message } }));
        }
    };

    const renderPadStatusIcon = (status: PadStatus) => {
        switch(status) {
            case 'uploading':
            case 'saving':
                return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                 return <XCircle className="w-5 h-5 text-destructive" />;
            default:
                return <AudioLines className="w-5 h-5 text-muted-foreground" />;
        }
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración del Sampler Pad</CardTitle>
                <CardDescription>
                    Sube y asigna archivos de audio a cada uno de los pads. Organiza tus sonidos en 4 grupos (X-D), cada uno con 4 pads (1-4).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-6">
                    <div>
                        <h3 className="text-lg font-medium mb-2">Seleccionar Grupo</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {topRowKeys.map((key) => (
                                <Button
                                    key={key}
                                    variant={selectedGroup === key ? 'default' : 'secondary'}
                                    onClick={() => setSelectedGroup(key)}
                                    className="h-12 text-lg"
                                >
                                    {key}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                         <h3 className="text-lg font-medium mb-4">Pads del Grupo <span className="text-primary">{selectedGroup}</span></h3>
                         {isLoading ? (
                            <div className="flex justify-center items-center h-48">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                         ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {bottomRowKeys.map((padKey) => {
                                    const padState = pads[padKey] || { status: 'idle', progress: 0, sample: null };
                                    const isProcessing = padState.status === 'uploading' || padState.status === 'saving';

                                    return (
                                        <div key={padKey} className="p-4 bg-secondary/50 rounded-lg border border-border flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold">Pad {padKey}</h4>
                                                <div className="w-8 h-8 flex items-center justify-center">
                                                    {renderPadStatusIcon(padState.status)}
                                                </div>
                                            </div>
                                            <Input
                                                type="text"
                                                placeholder="Nombre del sample"
                                                className="bg-input"
                                                value={padState.sample?.name || ''}
                                                onChange={(e) => handleNameChange(padKey, e.target.value)}
                                                onBlur={() => handleNameBlur(padKey)}
                                                disabled={isProcessing}
                                            />
                                            <input
                                                type="file"
                                                ref={(el) => (fileInputRefs.current[padKey] = el)}
                                                onChange={(e) => handleFileSelect(padKey, e)}
                                                className="hidden"
                                                accept="audio/*"
                                                disabled={isProcessing}
                                            />
                                            <Button 
                                                className="w-full gap-2" 
                                                variant="outline"
                                                onClick={() => fileInputRefs.current[padKey]?.click()}
                                                disabled={isProcessing}
                                            >
                                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
                                                {isProcessing ? 'Procesando...' : (padState.sample?.url ? 'Reemplazar' : 'Subir Audio')}
                                            </Button>
                                            {padState.status === 'uploading' && (
                                                <Progress value={padState.progress} className="h-1.5" />
                                            )}
                                            {padState.status === 'error' && (
                                                <p className="text-xs text-destructive">{padState.error}</p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                         )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default SamplerPadSettings;
