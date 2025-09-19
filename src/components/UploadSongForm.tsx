'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Upload, X, CheckCircle, XCircle, Clock, FileArchive, Cog, GripVertical } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { saveSong, NewSong, TrackFile } from '@/actions/songs';
import { Progress } from './ui/progress';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '@/contexts/AuthContext';
import PremiumUpsellDialog from './PremiumUpsellDialog';
import { TRIAL_SONG_LIMIT_ERROR } from '@/lib/constants';
import JSZip from 'jszip';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


const ACCEPTED_AUDIO_TYPES = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
const ACCEPTED_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/aac', 'audio/mp3'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const trackSchema = z.object({
  file: z
    .instanceof(File, { message: 'Se requiere un archivo.' })
    .refine((file) => file.size > 0, 'Se requiere un archivo.')
    .refine((file) => file.size <= MAX_FILE_SIZE, `El tamaño máximo es 100MB.`)
    .refine(
      (file) => file.type ? ACCEPTED_MIME_TYPES.includes(file.type) : true,
      'Formato de audio no soportado.'
    ),
  name: z.string().min(1, { message: 'El nombre de la pista es requerido.' }),
  handle: z.any().optional(),
});


const songFormSchema = z.object({
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
  artist: z.string().min(2, { message: 'El artista debe tener al menos 2 caracteres.' }),
  tempo: z.coerce.number().min(40, { message: 'El tempo debe ser al menos 40 BPM.' }).max(300, { message: 'El tempo no puede ser mayor a 300 BPM.' }),
  key: z.string().min(1, { message: 'La tonalidad es requerida.' }),
  timeSignature: z.string().min(3, { message: 'El compás es requerido.' }),
  albumImageUrl: z.string().url({ message: 'Por favor, introduce una URL válida.' }).optional().or(z.literal('')),
  lyrics: z.string().optional(),
  youtubeUrl: z.string().url({ message: 'Por favor, introduce una URL de YouTube válida.' }).optional().or(z.literal('')),
  tracks: z.array(trackSchema).min(1, { message: 'Debes subir al menos una pista.' }),
});

type SongFormValues = z.infer<typeof songFormSchema>;

interface UploadSongFormProps {
  onUploadFinished: () => void;
}

type TrackStatus = 'pending' | 'uploading' | 'success' | 'error';

interface SortableTrackItemProps {
    index: number;
    remove: (index: number) => void;
    isFormBusy: boolean;
    trackStatuses: Record<number, TrackStatus>;
    uploadProgress: Record<number, number>;
    trackErrorMessages: Record<number, string>;
}

const SortableTrackItem: React.FC<SortableTrackItemProps> = ({ index, remove, isFormBusy, trackStatuses, uploadProgress, trackErrorMessages }) => {
    const { control, getValues } = useFormContext<SongFormValues>();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: getValues(`tracks.${index}.file`).name });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    
    const StatusIcon = ({ status }: { status: TrackStatus }) => {
        switch (status) {
            case 'uploading': return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
            case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
            default: return <Clock className="w-5 h-5 text-muted-foreground" />;
        }
    };

    return (
        <div ref={setNodeRef} style={style}>
            <div className="flex items-center gap-2 p-2 border rounded-md">
                <div {...attributes} {...listeners} className="cursor-grab touch-none p-1">
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                </div>
                <StatusIcon status={trackStatuses[index] || 'pending'} />
                <div className="flex-grow space-y-1.5">
                    <FormField control={control} name={`tracks.${index}.name`} render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input {...field} className="h-8 text-sm" disabled={isFormBusy} placeholder="Edite los nombres aqui" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    {trackStatuses[index] === 'uploading' && <Progress value={uploadProgress[index]} className="h-1.5" />}
                </div>
                <div className="w-24 text-sm text-muted-foreground truncate">{getValues(`tracks.${index}.file.name`)}</div>
                <Button type="button" variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => remove(index)} disabled={isFormBusy}>
                    <X className="w-4 h-4" />
                </Button>
            </div>
            {trackStatuses[index] === 'error' && <p className="text-xs text-destructive mt-1 ml-2">{trackErrorMessages[index]}</p>}
        </div>
    );
};


const UploadSongForm: React.FC<UploadSongFormProps> = ({ onUploadFinished }) => {
  const { user } = useAuth();
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [trackStatuses, setTrackStatuses] = useState<Record<number, TrackStatus>>({});
  const [trackErrorMessages, setTrackErrorMessages] = useState<Record<number, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  const { toast } = useToast();
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const form = useForm<SongFormValues>({
    resolver: zodResolver(songFormSchema),
    defaultValues: {
      name: '',
      artist: '',
      tempo: 120,
      key: 'C',
      timeSignature: '4/4',
      albumImageUrl: '',
      lyrics: '',
      youtubeUrl: '',
      tracks: [],
    },
  });

  const { fields, remove, replace, move } = useFieldArray({
    control: form.control,
    name: 'tracks',
  });
  
  const resetComponentState = () => {
    form.reset({
      name: '', artist: '', tempo: 120, key: 'C', timeSignature: '4/4',
      albumImageUrl: '', lyrics: '', youtubeUrl: '', tracks: [],
    });
    setSelectedZipFile(null);
    setIsProcessing(false);
    setZipProgress(0);
    setIsUploading(false);
    setTrackStatuses({});
    setTrackErrorMessages({});
    setUploadProgress({});
  }
  
  const handleFilePicker = () => {
    const input = document.getElementById('file-picker-input');
    input?.click();
  };

  const processAudioFiles = async (files: File[]) => {
    setIsProcessing(true);
    let audioTracks: { file: File, name: string, handle: undefined }[] = [];
    
    for (const file of files) {
        if (ACCEPTED_MIME_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE) {
            const trackName = file.name.split('.').slice(0, -1).join('.') || file.name;
            audioTracks.push({ file, name: trackName, handle: undefined });
        } else {
            toast({ variant: "destructive", title: "Archivo no válido", description: `El archivo "${file.name}" no es soportado o es demasiado grande.` });
        }
    }
    
    if (audioTracks.length > 0) {
        replace(audioTracks);
        if (!form.getValues('name')) {
            form.setValue('name', audioTracks[0].name.split('.').slice(0, -1).join('.'));
        }
    }
    setIsProcessing(false);
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    const zipFile = fileArray.find(f => f.type === 'application/zip' || f.name.endsWith('.zip'));

    if (zipFile) {
      if (fileArray.length > 1) {
        toast({ variant: "destructive", title: "Selección mixta no permitida", description: "Por favor, selecciona un solo archivo ZIP, o varios archivos de audio." });
      } else {
        setSelectedZipFile(zipFile);
        const songNameFromZip = zipFile.name.split('.').slice(0, -1).join('.');
        if (!form.getValues('name') && songNameFromZip) {
            form.setValue('name', songNameFromZip);
        }
      }
    } else {
      processAudioFiles(fileArray);
    }
    
    event.target.value = '';
  };

  const processZipFile = async () => {
    if (!selectedZipFile) return;

    setIsProcessing(true);
    setZipProgress(30);
    
    let allTracks: { file: File, name: string, handle: undefined }[] = [];
    
    try {
        const zip = await JSZip.loadAsync(selectedZipFile);
        setZipProgress(60);

        for (const zipEntry of Object.values(zip.files)) {
            if (!zipEntry.dir && ACCEPTED_AUDIO_TYPES.some(type => zipEntry.name.toLowerCase().endsWith(type))) {
                const blob = await zipEntry.async('blob');
                const trackFile = new File([blob], zipEntry.name, { type: blob.type });
                if (trackFile.size <= MAX_FILE_SIZE) {
                    const trackName = trackFile.name.split('.').slice(0, -1).join('.') || trackFile.name;
                    allTracks.push({ file: trackFile, name: trackName, handle: undefined });
                } else {
                    toast({ variant: "destructive", title: "Archivo demasiado grande", description: `"${trackFile.name}" del ZIP excede 100MB.` });
                }
            }
        }
        
        setZipProgress(100);
        
        if (allTracks.length > 0) {
            // Auto-sort CUES and CLICK to top
            const getPrio = (trackName: string) => {
                const upperCaseName = trackName.trim().toUpperCase();
                if (upperCaseName === 'CLICK') return 1;
                if (['CUES', 'GUIA', 'GUIDES', 'GUIDE'].includes(upperCaseName)) return 2;
                return 3;
            };
            allTracks.sort((a, b) => getPrio(a.name) - getPrio(b.name));
            
            replace(allTracks);
            toast({ title: 'ZIP procesado', description: `${allTracks.length} pistas de audio extraídas.` });
        } else {
             toast({ variant: "destructive", title: "ZIP vacío", description: `No se encontraron archivos de audio soportados en el ZIP.` });
        }

    } catch (error) {
        toast({ variant: "destructive", title: "Error al leer el ZIP", description: "El archivo podría estar corrupto." });
    } finally {
        setTimeout(() => {
          setIsProcessing(false);
          setSelectedZipFile(null);
          setZipProgress(0);
        }, 500);
    }
  }

  const uploadTrackWithProgress = (formData: FormData, index: number): Promise<{ success: boolean, track?: Omit<TrackFile, 'handle'>, error?: string }> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress(prev => ({ ...prev, [index]: percentComplete }));
        }
      };
      xhr.onload = () => {
        let response = null;
        try { response = JSON.parse(xhr.responseText); } catch (e) {
          resolve({ success: false, error: `Respuesta del servidor inválida: ${xhr.responseText}` }); return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
            if (response.success) resolve({ success: true, track: response.track });
            else resolve({ success: false, error: response.error || `Error del servidor al subir.` });
        } else {
           resolve({ success: false, error: response.error || `Error del servidor: ${xhr.statusText}` });
        }
      };
      xhr.onerror = () => resolve({ success: false, error: 'Error de red al subir el archivo.' });
      xhr.open('POST', '/api/upload-track', true);
      xhr.send(formData);
    });
  }

  async function onSubmit(data: SongFormValues) {
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para subir una canción.' });
      return;
    }
    
    setIsUploading(true);

    const preCheckResult = await saveSong({
      name: data.name, artist: data.artist, tempo: data.tempo, key: data.key,
      timeSignature: data.timeSignature, tracks: [], userId: user.uid,
    });

    if (preCheckResult.error === TRIAL_SONG_LIMIT_ERROR) {
      setShowPremiumDialog(true);
      setIsUploading(false);
      return;
    }
    
    if (!preCheckResult.success && preCheckResult.error) {
      toast({ variant: 'destructive', title: 'Error de Pre-verificación', description: preCheckResult.error });
      setIsUploading(false);
      return;
    }
    
    const uploadedTracks: TrackFile[] = [];
    for (let i = 0; i < data.tracks.length; i++) {
        const track = data.tracks[i];
        try {
            setTrackStatuses(prev => ({ ...prev, [i]: 'uploading' }));
            const formData = new FormData();
            formData.append('file', track.file);
            formData.append('trackName', track.name);
            const result = await uploadTrackWithProgress(formData, i);
            if (!result.success || !result.track) throw new Error(result.error || `Error desconocido al subir ${track.name}.`);
            const finalTrack: TrackFile = { ...result.track, handle: track.handle };
            uploadedTracks.push(finalTrack);
            setTrackStatuses(prev => ({ ...prev, [i]: 'success' }));
        } catch (error) {
            setTrackStatuses(prev => ({ ...prev, [i]: 'error' }));
            setTrackErrorMessages(prev => ({ ...prev, [i]: (error as Error).message }));
        }
    }

    if (uploadedTracks.length === 0) {
        toast({ variant: 'destructive', title: 'Subida fallida', description: 'Ninguna de las pistas pudo ser subida.' });
        setIsUploading(false);
        return;
    }
    if (uploadedTracks.length < data.tracks.length) {
         toast({ variant: 'destructive', title: 'Subida parcial', description: `Se subieron ${uploadedTracks.length} de ${data.tracks.length} pistas.` });
    }

    try {
        const songData: NewSong = {
          name: data.name, artist: data.artist, tempo: data.tempo, key: data.key,
          timeSignature: data.timeSignature, albumImageUrl: data.albumImageUrl,
          lyrics: data.lyrics, youtubeUrl: data.youtubeUrl, tracks: uploadedTracks,
          userId: user.uid,
        };
        const finalSaveResult = await saveSong(songData);

        if (!finalSaveResult.success || !finalSaveResult.song) {
             throw new Error(finalSaveResult.error || 'No se pudo guardar la canción.');
        }

        toast({ title: '¡Éxito!', description: `La canción "${finalSaveResult.song.name}" ha sido guardada.` });
        setTimeout(() => { resetComponentState(); onUploadFinished(); }, 1000);
    } catch (error) {
         toast({ variant: 'destructive', title: 'Error al guardar la canción', description: (error as Error).message });
         setIsUploading(false);
    }
  }
  
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.file.name === active.id);
      const newIndex = fields.findIndex((field) => field.file.name === over.id);
      move(oldIndex, newIndex);
    }
  }

  const tracksError = form.formState.errors.tracks;
  const isFormBusy = isUploading || isProcessing;

  return (
    <>
    <PremiumUpsellDialog
        isOpen={showPremiumDialog}
        onClose={() => setShowPremiumDialog(false)}
        onConfirm={() => {
            console.log("Redirecting to subscription page...");
            setShowPremiumDialog(false);
        }}
    />
    <Card>
        <CardContent className="pt-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Información de la Canción</CardTitle>
                            <CardDescription>Metadatos principales de la canción.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Nombre de la canción</FormLabel><FormControl><Input placeholder="Ej: Gracia Sublime es" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="artist" render={({ field }) => (
                                <FormItem><FormLabel>Artista</FormLabel><FormControl><Input placeholder="Ej: Elevation Worship" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="albumImageUrl" render={({ field }) => (
                                <FormItem><FormLabel>URL de la carátula (opcional)</FormLabel><FormControl><Input placeholder="https://ejemplo.com/imagen.jpg" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-3 gap-4">
                                <FormField control={form.control} name="tempo" render={({ field }) => (
                                <FormItem><FormLabel>Tempo (BPM)</FormLabel><FormControl><Input type="number" placeholder="120" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="key" render={({ field }) => (
                                <FormItem><FormLabel>Tonalidad</FormLabel><FormControl><Input placeholder="C" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="timeSignature" render={({ field }) => (
                                <FormItem><FormLabel>Compás</FormLabel><FormControl><Input placeholder="4/4" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader>
                            <CardTitle>Archivos de Pistas</CardTitle>
                            <CardDescription>Selecciona los archivos de audio (WAV, MP3, etc.) o un archivo ZIP que los contenga.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <FormItem>
                                <FormControl>
                                    <Button type="button" variant="outline" onClick={handleFilePicker} disabled={isFormBusy} className="w-full">
                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                                        {isProcessing ? 'Procesando Archivos...' : 'Seleccionar Pistas o ZIP'}
                                    </Button>
                                </FormControl>
                                <input id="file-picker-input" type="file" multiple className="hidden" onChange={handleFileChange} accept={[...ACCEPTED_AUDIO_TYPES, ".zip"].join(',')} />
                                {tracksError && !selectedZipFile && <p className="text-sm font-medium text-destructive">{tracksError.message}</p>}
                            </FormItem>
                            
                            {selectedZipFile && (
                                <div className="mt-4 space-y-3">
                                    <FormLabel>Archivo ZIP seleccionado</FormLabel>
                                    <div className="flex items-center gap-2 p-2 border rounded-md bg-secondary/30">
                                        <FileArchive className="w-5 h-5 text-primary" />
                                        <div className="flex-grow space-y-1.5">
                                            <p className="text-sm font-medium">{selectedZipFile.name}</p>
                                            {isProcessing && <Progress value={zipProgress} className="h-1.5" />}
                                        </div>
                                        {isProcessing ? (
                                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                        ) : (
                                            <>
                                                <Button type="button" variant="ghost" size="sm" onClick={processZipFile} className="gap-1">
                                                    <Cog className="w-4 h-4"/> Procesar
                                                </Button>
                                                <Button type="button" variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => setSelectedZipFile(null)}><X className="w-4 h-4" /></Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {fields.length > 0 && (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <div className="space-y-3 mt-4">
                                    <FormLabel>Pistas a subir ({fields.length})</FormLabel>
                                    <ScrollArea className="h-48 pr-4">
                                        <SortableContext items={fields.map(field => field.file.name)} strategy={verticalListSortingStrategy}>
                                            <div className="space-y-2">
                                                {fields.map((field, index) => (
                                                    <SortableTrackItem
                                                        key={field.id}
                                                        index={index}
                                                        remove={remove}
                                                        isFormBusy={isFormBusy}
                                                        trackStatuses={trackStatuses}
                                                        uploadProgress={uploadProgress}
                                                        trackErrorMessages={trackErrorMessages}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </ScrollArea>
                                </div>
                            </DndContext>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Contenido Adicional (Opcional)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="lyrics" render={({ field }) => (
                                <FormItem><FormLabel>Letra de la canción</FormLabel><FormControl><Textarea placeholder="[Intro]&#10;[Verso 1]&#10;..." {...field} rows={8} className="bg-input" /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="youtubeUrl" render={({ field }) => (
                                <FormItem><FormLabel>URL de YouTube</FormLabel><FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </CardContent>
                    </Card>
                    
                    <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" disabled={isFormBusy || !form.formState.isDirty || !form.formState.isValid}>
                            {isFormBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isUploading ? 'Subiendo y Guardando...' : (isProcessing ? 'Procesando...' : 'Guardar Canción')}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
    </Card>
    </>
  );
};

export default UploadSongForm;
