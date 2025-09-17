
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Loader2, Zap, CheckCircle, Mic } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { updateSong, Song, SongUpdateData, synchronizeLyrics, transcribeLyrics } from '@/actions/songs';
import { Textarea } from './ui/textarea';
import { blobToDataURI } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

const editSongFormSchema = z.object({
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
  artist: z.string().min(2, { message: 'El artista debe tener al menos 2 caracteres.' }),
  lyrics: z.string().optional(),
  youtubeUrl: z.string().url({ message: 'Por favor, introduce una URL de YouTube válida.' }).optional().or(z.literal('')),
  syncOffset: z.coerce.number().optional(),
});

type EditSongFormValues = z.infer<typeof editSongFormSchema>;

interface EditSongDialogProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
  onSongUpdated: (updatedSong: Song) => void;
}

type AIOperation = 'transcribe' | 'sync';

const EditSongDialog: React.FC<EditSongDialogProps> = ({ song, isOpen, onClose, onSongUpdated }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState<AIOperation | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ open: boolean, operation: AIOperation | null, title: string, description: string, actionText: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<EditSongFormValues>({
    resolver: zodResolver(editSongFormSchema),
    defaultValues: {
      name: song.name,
      artist: song.artist,
      lyrics: song.lyrics || '',
      youtubeUrl: song.youtubeUrl || '',
      syncOffset: song.syncOffset || 0,
    },
  });

  useEffect(() => {
    if (song) {
        form.reset({
            name: song.name,
            artist: song.artist,
            lyrics: song.lyrics || '',
            youtubeUrl: song.youtubeUrl || '',
            syncOffset: song.syncOffset || 0,
        });
    }
  }, [song, form]);


  async function onSubmit(data: EditSongFormValues) {
    setIsSaving(true);
    try {
      const updateData: SongUpdateData = {
        name: data.name,
        artist: data.artist,
        lyrics: data.lyrics,
        youtubeUrl: data.youtubeUrl,
        syncOffset: data.syncOffset,
      };
      
      const result = await updateSong(song.id, updateData);

      if (result.success && result.song) {
        toast({
          title: '¡Éxito!',
          description: `La canción "${result.song.name}" ha sido actualizada.`,
        });
        onSongUpdated(result.song);
        onClose();
      } else {
        throw new Error(result.error || 'No se pudo actualizar la canción.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: (error as Error).message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  const handleAIOperationClick = (operation: AIOperation) => {
    const dialogs = {
      transcribe: {
        title: 'Transcribir letra con IA',
        description: `Para transcribir, necesitas subir el archivo de audio (MP3, WAV, etc.) de la canción completa. La IA generará la letra y la pondrá en el campo de texto.\n\n<span class="font-bold text-foreground">Importante:</span> El audio no se guardará, solo se usará para el análisis.`,
        actionText: 'Seleccionar Archivo para Transcribir'
      },
      sync: {
        title: 'Sincronizar tiempos con IA',
        description: `La IA analizará la letra en el campo de texto y la sincronizará con el audio que subas. Esto creará los tiempos para el modo karaoke.\n\n<span class="font-bold text-foreground">Importante:</span> El audio no se guardará, solo se usará para el análisis.`,
        actionText: 'Seleccionar Archivo para Sincronizar'
      }
    };
    setAlertInfo({ open: true, operation, ...dialogs[operation] });
  }

  const handleFileSelectedForAI = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !alertInfo?.operation) return;

    if (!file.type.startsWith('audio/')) {
        toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Por favor, selecciona un archivo de audio (MP3, WAV, etc.).' });
        return;
    }

    const operation = alertInfo.operation;
    setIsProcessingAI(operation);
    toast({ title: 'Procesando...', description: operation === 'transcribe' ? 'La IA está transcribiendo la canción. Esto puede tardar unos minutos.' : 'La IA está sincronizando la letra. Esto puede tardar un momento.' });

    try {
        const audioDataUri = await blobToDataURI(file);
        
        let result;
        if (operation === 'transcribe') {
          result = await transcribeLyrics(song.id, { audioDataUri });
        } else { // sync
          const lyrics = form.getValues('lyrics');
          if (!lyrics) throw new Error('No hay letra en el campo de texto para sincronizar.');
          result = await synchronizeLyrics(song.id, { audioDataUri, lyrics });
        }

        if (result.success && result.song) {
            toast({
                title: `¡${operation === 'transcribe' ? 'Transcripción' : 'Sincronización'} completa!`,
                description: `La operación ha finalizado para "${result.song.name}".`,
            });
            onSongUpdated(result.song);
        } else {
            throw new Error(result.error || `Ocurrió un error desconocido durante la operación.`);
        }

    } catch (error) {
        toast({
            variant: 'destructive',
            title: `Error de ${operation === 'transcribe' ? 'transcripción' : 'sincronización'}`,
            description: (error as Error).message,
        });
    } finally {
        setIsProcessingAI(null);
    }
  };
  
  const hasLyrics = !!form.watch('lyrics')?.trim();
  const hasSyncedLyrics = !!song.syncedLyrics && song.syncedLyrics.words.length > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Canción</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la canción. Los cambios se guardarán en la biblioteca.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <ScrollArea className="h-[450px] pr-6">
                <div className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre de la canción</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="artist" render={({ field }) => (
                    <FormItem><FormLabel>Artista</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                   <FormField control={form.control} name="youtubeUrl" render={({ field }) => (
                    <FormItem><FormLabel>URL de YouTube (opcional)</FormLabel><FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="lyrics" render={({ field }) => (
                    <FormItem>
                        <div className="flex justify-between items-center">
                            <FormLabel>Letra de la canción</FormLabel>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelectedForAI}
                                    className="hidden"
                                    accept="audio/*"
                                />
                                {!hasLyrics && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAIOperationClick('transcribe')}
                                        disabled={!!isProcessingAI}
                                        className="gap-2"
                                    >
                                        {isProcessingAI === 'transcribe' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                                        Transcribir
                                    </Button>
                                )}
                                 <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAIOperationClick('sync')}
                                    disabled={!hasLyrics || !!isProcessingAI}
                                    className="gap-2"
                                >
                                    {isProcessingAI === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    Sincronizar
                                </Button>
                            </div>
                        </div>
                        {hasSyncedLyrics && (
                             <div className="flex items-center gap-2 text-sm text-green-500 mt-2">
                                <CheckCircle className="w-4 h-4" />
                                <span>Tiempos de karaoke sincronizados.</span>
                            </div>
                        )}
                        <FormControl>
                            <Textarea placeholder="Puedes pegar la letra aquí, o usar la IA para transcribirla desde un archivo de audio." {...field} rows={10} className="bg-input" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                  )}/>
                   <FormField control={form.control} name="syncOffset" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Desplazamiento de la letra (en segundos)</FormLabel>
                        <FormControl>
                            <Input 
                                type="number" 
                                placeholder="Ej: 2, o -3" 
                                {...field} 
                            />
                        </FormControl>
                        <FormDescription>
                          Usa números positivos para que la letra aparezca ANTES (ej: 2) o negativos para que aparezca DESPUÉS (ej: -3).
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                  )}/>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving || !!isProcessingAI}>
                  {(isSaving || isProcessingAI) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSaving ? 'Guardando...' : (isProcessingAI ? 'Procesando IA...' : 'Guardar Cambios')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={alertInfo?.open ?? false} onOpenChange={(isOpen) => setAlertInfo(prev => prev ? {...prev, open: isOpen} : null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{alertInfo?.title}</AlertDialogTitle>
                <AlertDialogDescription dangerouslySetInnerHTML={{ __html: alertInfo?.description || '' }} />
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => fileInputRef.current?.click()}>
                    {alertInfo?.actionText}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditSongDialog;
