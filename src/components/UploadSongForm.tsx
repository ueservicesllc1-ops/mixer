

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
import { Loader2, Upload, X, CheckCircle, XCircle, Clock, FileZip } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { saveSong, NewSong, TrackFile } from '@/actions/songs';
import { Progress } from './ui/progress';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '@/contexts/AuthContext';
import PremiumUpsellDialog from './PremiumUpsellDialog';
import { TRIAL_SONG_LIMIT, TRIAL_SONG_LIMIT_ERROR } from '@/lib/constants';
import JSZip from 'jszip';


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

const UploadSongForm: React.FC<UploadSongFormProps> = ({ onUploadFinished }) => {
  const { user } = useAuth();
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [trackStatuses, setTrackStatuses] = useState<Record<number, TrackStatus>>({});
  const [trackErrorMessages, setTrackErrorMessages] = useState<Record<number, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  const { toast } = useToast();

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

  const { fields, remove, replace } = useFieldArray({
    control: form.control,
    name: 'tracks',
  });
  
  const resetComponentState = () => {
    form.reset({
      name: '', artist: '', tempo: 120, key: 'C', timeSignature: '4/4',
      albumImageUrl: '', lyrics: '', youtubeUrl: '', tracks: [],
    });
    setIsUploading(false);
    setTrackStatuses({});
    setTrackErrorMessages({});
    setUploadProgress({});
  }

  const processFiles = async (files: FileList | File[]) => {
    setIsProcessingFiles(true);
    let allTracks: { file: File, name: string, handle: undefined }[] = [];

    for (const file of Array.from(files)) {
        if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
            toast({ title: 'Procesando archivo ZIP...', description: 'Extrayendo pistas de audio.' });
            try {
                const zip = await JSZip.loadAsync(file);
                const songNameFromZip = file.name.split('.').slice(0, -1).join('.');
                if (!form.getValues('name') && songNameFromZip) {
                    form.setValue('name', songNameFromZip);
                }

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
            } catch (error) {
                toast({ variant: "destructive", title: "Error al leer el ZIP", description: "El archivo podría estar corrupto." });
            }
        } else if (ACCEPTED_MIME_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE) {
            const trackName = file.name.split('.').slice(0, -1).join('.') || file.name;
            allTracks.push({ file, name: trackName, handle: undefined });
        } else {
            toast({ variant: "destructive", title: "Archivo no válido", description: `El archivo "${file.name}" no es soportado o es demasiado grande.` });
        }
    }

    if (allTracks.length > 0) {
        replace(allTracks);
        if (!form.getValues('name')) {
            form.setValue('name', allTracks[0].name.split('.').slice(0, -1).join('.'));
        }
    }
    setIsProcessingFiles(false);
  }

  const handleFilePicker = () => {
    document.getElementById('file-picker-input-fallback')?.click();
  };
  
  const handleFallbackFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;
      processFiles(files);
      event.target.value = '';
  };

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

    const saveResult = await saveSong({
      name: data.name, artist: data.artist, tempo: data.tempo, key: data.key,
      timeSignature: data.timeSignature, albumImageUrl: data.albumImageUrl,
      lyrics: data.lyrics, youtubeUrl: data.youtubeUrl, tracks: [], // Pasamos tracks vacío inicialmente
      userId: user.uid,
    });

    if (saveResult.error === TRIAL_SONG_LIMIT_ERROR) {
      setShowPremiumDialog(true);
      return;
    }
    
    if (!saveResult.success) {
      toast({ variant: 'destructive', title: 'Error', description: saveResult.error || 'No se pudo verificar el límite de canciones.' });
      return;
    }


    setIsUploading(true);
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
  
  const StatusIcon = ({ status }: { status: TrackStatus }) => {
    switch (status) {
        case 'uploading': return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
        case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
        default: return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  }

  const tracksError = form.formState.errors.tracks;
  const isFormBusy = isUploading || isProcessingFiles;

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
                                        {isProcessingFiles ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                                        {isProcessingFiles ? 'Procesando Archivos...' : 'Seleccionar Pistas o ZIP'}
                                    </Button>
                                </FormControl>
                                <input id="file-picker-input-fallback" type="file" multiple className="hidden" onChange={handleFallbackFileChange} accept={[...ACCEPTED_AUDIO_TYPES, ".zip"].join(',')} />
                                {tracksError && <p className="text-sm font-medium text-destructive">{tracksError.message}</p>}
                            </FormItem>
                            {fields.length > 0 && (
                            <div className="space-y-3 mt-4">
                                <FormLabel>Pistas a subir ({fields.length})</FormLabel>
                                <ScrollArea className="h-48 pr-4">
                                    <div className="space-y-2">
                                        {fields.map((field, index) => (
                                        <div key={field.id}>
                                            <div className="flex items-center gap-2 p-2 border rounded-md">
                                            <StatusIcon status={trackStatuses[index] || 'pending'} />
                                            <div className="flex-grow space-y-1.5">
                                                <FormField control={form.control} name={`tracks.${index}.name`} render={({ field }) => (
                                                    <FormItem><FormControl><Input {...field} className="h-8 text-sm" disabled={isFormBusy}/></FormControl><FormMessage /></FormItem>
                                                )}/>
                                                {trackStatuses[index] === 'uploading' && <Progress value={uploadProgress[index]} className="h-1.5" />}
                                            </div>
                                            <div className="w-24 text-sm text-muted-foreground truncate">{form.getValues(`tracks.${index}.file.name`)}</div>
                                            <Button type="button" variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => remove(index)} disabled={isFormBusy}><X className="w-4 h-4" /></Button>
                                            </div>
                                            {trackStatuses[index] === 'error' && <p className="text-xs text-destructive mt-1 ml-2">{trackErrorMessages[index]}</p>}
                                        </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
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
                            {isUploading ? 'Subiendo y Guardando...' : (isProcessingFiles ? 'Procesando...' : 'Guardar Canción')}
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
