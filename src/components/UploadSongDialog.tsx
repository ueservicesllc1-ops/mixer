'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Loader2, Upload, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { saveSong, NewSong, TrackFile } from '@/actions/songs';
import { Progress } from './ui/progress';
import { Textarea } from './ui/textarea';

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

interface UploadSongDialogProps {
  onUploadFinished: () => void;
}

type TrackStatus = 'pending' | 'uploading' | 'success' | 'error';

const UploadSongDialog: React.FC<UploadSongDialogProps> = ({ onUploadFinished }) => {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [trackStatuses, setTrackStatuses] = useState<Record<number, TrackStatus>>({});
  const [trackErrorMessages, setTrackErrorMessages] = useState<Record<number, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
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

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'tracks',
  });
  
  const resetComponentState = () => {
    form.reset({
      name: '',
      artist: '',
      tempo: 120,
      key: 'C',
      timeSignature: '4/4',
      albumImageUrl: '',
      lyrics: '',
      youtubeUrl: '',
      tracks: [],
    });
    setIsUploading(false);
    setTrackStatuses({});
    setTrackErrorMessages({});
    setUploadProgress({});
  }

  const handleFilePicker = async () => {
    if (!window.showOpenFilePicker) {
        console.warn('File System Access API no es soportada o está bloqueada. Usando input de archivo como fallback.');
        document.getElementById('file-picker-input-fallback')?.click();
        return;
    }

    try {
        const handles = await window.showOpenFilePicker({
            multiple: true,
            types: [{ description: 'Audio Files', accept: { 'audio/*': ACCEPTED_AUDIO_TYPES } }],
        });

        const newTracks = [];
        for (const handle of handles) {
            const file = await handle.getFile();
            // Validar aquí también por si el usuario cambia a "Todos los archivos"
            if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
                toast({ variant: "destructive", title: "Archivo no soportado", description: `El archivo "${file.name}" fue ignorado.`});
                continue;
            }
             if (file.size > MAX_FILE_SIZE) {
                toast({ variant: "destructive", title: "Archivo demasiado grande", description: `El archivo "${file.name}" excede 100MB y fue ignorado.`});
                continue;
            }
            const trackName = file.name.split('.').slice(0, -1).join('.') || file.name;
            newTracks.push({ file, name: trackName, handle });
        }
        
        if (newTracks.length > 0) {
            replace(newTracks); // Reemplaza todas las pistas para evitar duplicados
             if (!form.getValues('name')) {
                form.setValue('name', newTracks[0].name.split('.').slice(0, -1).join('.'));
            }
        }
    } catch (err: any) {
        if (err.name === 'AbortError') {
            // El usuario canceló el selector de archivos, no hacer nada.
            console.log("Selector de archivos cancelado por el usuario.");
        } else if (err.name === 'SecurityError') {
            console.warn("SecurityError con showOpenFilePicker. Usando fallback.", err);
            document.getElementById('file-picker-input-fallback')?.click();
        } else {
            console.error("Error al usar File System Access API:", err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron seleccionar los archivos. Reintentando con el método clásico.' });
            document.getElementById('file-picker-input-fallback')?.click();
        }
    }
  };
  
  const handleFallbackFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const newTracks = [];
      for (const file of Array.from(files)) {
          if (!ACCEPTED_MIME_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) {
              toast({ variant: "destructive", title: "Archivo no válido", description: `El archivo "${file.name}" es demasiado grande o su formato no es soportado.`});
              continue;
          }
          const trackName = file.name.split('.').slice(0, -1).join('.') || file.name;
          newTracks.push({ file, name: trackName, handle: undefined }); // No handle in fallback
      }

      if (newTracks.length > 0) {
        replace(newTracks);
        if (!form.getValues('name')) {
            form.setValue('name', newTracks[0].name.split('.').slice(0, -1).join('.'));
        }
      }
      event.target.value = ''; // Reset input
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
        try {
          response = JSON.parse(xhr.responseText);
        } catch (e) {
          resolve({ success: false, error: `Respuesta del servidor inválida: ${xhr.responseText}` });
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
            if (response.success) {
              resolve({ success: true, track: response.track });
            } else {
              resolve({ success: false, error: response.error || `Error del servidor al subir.` });
            }
        } else {
           resolve({ success: false, error: response.error || `Error del servidor: ${xhr.statusText}` });
        }
      };

      xhr.onerror = () => {
         resolve({ success: false, error: 'Error de red al subir el archivo.' });
      };

      xhr.open('POST', '/api/upload-track', true);
      xhr.send(formData);
    });
  }

  async function onSubmit(data: SongFormValues) {
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

            if (!result.success || !result.track) {
                throw new Error(result.error || `Error desconocido al subir ${track.name}.`);
            }
            
            const finalTrack: TrackFile = {
              ...result.track,
              handle: track.handle
            };

            uploadedTracks.push(finalTrack);
            setTrackStatuses(prev => ({ ...prev, [i]: 'success' }));

        } catch (error) {
            setTrackStatuses(prev => ({ ...prev, [i]: 'error' }));
            setTrackErrorMessages(prev => ({ ...prev, [i]: (error as Error).message }));
        }
    }

    if (uploadedTracks.length === 0) {
        toast({
            variant: 'destructive',
            title: 'Subida fallida',
            description: 'Ninguna de las pistas pudo ser subida. Por favor, inténtalo de nuevo.',
        });
        setIsUploading(false);
        return;
    }
    
    if (uploadedTracks.length < data.tracks.length) {
         toast({
            variant: 'destructive',
            title: 'Subida parcial',
            description: `Se subieron ${uploadedTracks.length} de ${data.tracks.length} pistas. La canción se guardará con las pistas exitosas.`,
        });
    }

    try {
        const songData: NewSong = {
          name: data.name,
          artist: data.artist,
          tempo: data.tempo,
          key: data.key,
          timeSignature: data.timeSignature,
          albumImageUrl: data.albumImageUrl,
          lyrics: data.lyrics,
          youtubeUrl: data.youtubeUrl,
          tracks: uploadedTracks,
        };
        
        const saveResult = await saveSong(songData);

        if (!saveResult.success || !saveResult.song) {
           throw new Error(saveResult.error || 'No se pudo guardar la canción en la base de datos.');
        }
        
        toast({
          title: '¡Éxito!',
          description: `La canción "${saveResult.song.name}" ha sido guardada.`,
        });

        setTimeout(() => {
          setOpen(false);
          onUploadFinished();
        }, 1000);


    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Error al guardar la canción',
            description: (error as Error).message,
        });
        setIsUploading(false);
    }
  }
  
  const StatusIcon = ({ status }: { status: TrackStatus }) => {
    switch (status) {
        case 'uploading':
            return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
        case 'success':
            return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'error':
            return <XCircle className="w-5 h-5 text-destructive" />;
        case 'pending':
        default:
            return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  }

  const tracksError = form.formState.errors.tracks;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetComponentState();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
            <Upload className="w-4 h-4" />
            Subir Canción
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Subir nueva canción (grupo de pistas)</DialogTitle>
          <DialogDescription>
            Añade los metadatos de la canción y sube todos los archivos de las pistas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-[450px] pr-6">
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la canción</FormLabel>
                    <FormControl><Input placeholder="Ej: Gracia Sublime es" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="artist" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artista</FormLabel>
                    <FormControl><Input placeholder="Ej: Elevation Worship" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="albumImageUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de la carátula (opcional)</FormLabel>
                    <FormControl><Input placeholder="https://ejemplo.com/imagen.jpg" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="tempo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tempo (BPM)</FormLabel>
                      <FormControl><Input type="number" placeholder="120" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="key" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tonalidad</FormLabel>
                      <FormControl><Input placeholder="C" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="timeSignature" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compás</FormLabel>
                      <FormControl><Input placeholder="4/4" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                </div>
                
                 <FormField control={form.control} name="lyrics" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Letra de la canción (opcional)</FormLabel>
                      <FormControl><Textarea placeholder="[Intro]&#10;[Verso 1]&#10;..." {...field} rows={6} className="bg-input" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>

                <FormField control={form.control} name="youtubeUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de YouTube (opcional)</FormLabel>
                      <FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                
                <FormItem>
                  <FormLabel className={tracksError ? 'text-destructive' : ''}>
                    Archivos de Pistas
                  </FormLabel>
                  <FormControl>
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleFilePicker}
                      disabled={isUploading}
                      className="w-full"
                    >
                      Seleccionar Archivos de Pistas
                    </Button>
                  </FormControl>
                   <input
                    id="file-picker-input-fallback"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFallbackFileChange}
                    accept={ACCEPTED_AUDIO_TYPES.join(',')}
                  />
                  {tracksError && <p className="text-sm font-medium text-destructive">{tracksError.message}</p>}
                </FormItem>

                {fields.length > 0 && (
                  <div className="space-y-3">
                    <FormLabel>Pistas a subir</FormLabel>
                    {fields.map((field, index) => (
                      <div key={field.id}>
                        <div className="flex items-center gap-2 p-2 border rounded-md">
                          <StatusIcon status={trackStatuses[index] || 'pending'} />
                          <div className="flex-grow space-y-1.5">
                             <FormField control={form.control} name={`tracks.${index}.name`} render={({ field }) => (
                                <FormItem>
                                  <FormControl><Input {...field} className="h-8 text-sm" disabled={isUploading}/></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}/>
                            {trackStatuses[index] === 'uploading' && (
                                <Progress value={uploadProgress[index]} className="h-1.5" />
                            )}
                          </div>
                           <div className="w-24 text-sm text-muted-foreground truncate">
                              {form.getValues(`tracks.${index}.file.name`)}
                           </div>
                          <Button type="button" variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => remove(index)} disabled={isUploading}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                         {trackStatuses[index] === 'error' && (
                            <p className="text-xs text-destructive mt-1 ml-2">{trackErrorMessages[index]}</p>
                         )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isUploading}>Cancelar</Button>
              <Button type="submit" disabled={isUploading || !form.formState.isDirty || !form.formState.isValid}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isUploading ? 'Subiendo...' : 'Subir canción'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadSongDialog;
