
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Music, Pencil, ScanSearch, Trash2, Home, Library, UploadCloud } from 'lucide-react';
import { getSongs, Song, deleteSong, reanalyzeSongStructure } from '@/actions/songs';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { blobToDataURI } from '@/lib/utils';
import EditSongDialog from '@/components/EditSongDialog';
import Link from 'next/link';
import UploadSongForm from '@/components/UploadSongForm';
import { cn } from '@/lib/utils';

type AdminView = 'library' | 'upload';

const AdminPage = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(true);
  const [songsError, setSongsError] = useState<string | null>(null);
  const [songToEdit, setSongToEdit] = useState<Song | null>(null);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analyzingSongId, setAnalyzingSongId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AdminView>('library');
  const { toast } = useToast();

  const handleFetchSongs = async (selectLibraryView: boolean = false) => {
    setIsLoadingSongs(true);
    setSongsError(null);
    try {
      const result = await getSongs();
      if (result.success && result.songs) {
        setSongs(result.songs);
      } else {
        setSongsError(result.error || 'No se pudieron cargar las canciones.');
      }
    } catch (err) {
      setSongsError('Ocurrió un error al buscar las canciones.');
    } finally {
      setIsLoadingSongs(false);
      if (selectLibraryView) {
        setActiveView('library');
      }
    }
  };

  useEffect(() => {
    handleFetchSongs();
  }, []);

  const handleSongUpdated = (updatedSong: Song) => {
    setSongs(prevSongs => prevSongs.map(s => s.id === updatedSong.id ? updatedSong : s));
    setSongToEdit(null);
  };

  const confirmDeleteSong = async () => {
    if (!songToDelete) return;
    setIsDeleting(true);
    const result = await deleteSong(songToDelete);
    if (result.success) {
      toast({
        title: '¡Canción eliminada!',
        description: `"${songToDelete.name}" ha sido eliminada de la biblioteca.`,
      });
      setSongs(prevSongs => prevSongs.filter(s => s.id !== songToDelete.id));
    } else {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: result.error || 'No se pudo eliminar la canción.',
      });
    }
    setIsDeleting(false);
    setSongToDelete(null);
  };

  const handleReanalyze = async (song: Song) => {
    const cuesTrack = song.tracks.find(t => t.name.trim().toUpperCase() === 'CUES');
    if (!cuesTrack) {
      toast({ variant: 'destructive', title: 'Sin pista de Cues', description: `"${song.name}" no tiene una pista llamada 'CUES'.` });
      return;
    }
    setAnalyzingSongId(song.id);
    toast({ title: 'Iniciando análisis...', description: 'Descargando pista de Cues para el análisis.' });
    try {
      const response = await fetch(cuesTrack.url);
      if (!response.ok) throw new Error('Failed to download Cues track for analysis.');
      const audioBlob = await response.blob();
      const audioDataUri = await blobToDataURI(audioBlob);
      const result = await reanalyzeSongStructure(song.id, { audioDataUri });
      if (result.success && result.structure) {
        toast({
          title: 'Análisis completado',
          description: `Se ha analizado la estructura de "${song.name}".`,
        });
        setSongs(prevSongs => prevSongs.map(s => s.id === song.id ? { ...s, structure: result.structure } : s));
      } else {
        throw new Error(result.error || 'Ocurrió un error desconocido durante el análisis.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error en el análisis',
        description: (error as Error).message,
      });
    } finally {
      setAnalyzingSongId(null);
    }
  };
  
  const renderSongLibrary = () => {
    if (isLoadingSongs) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    if (songsError) {
      return <div className="text-destructive text-center p-4">{songsError}</div>;
    }
    if (songs.length > 0) {
      return (
        <div className="space-y-2">
          {songs.map((song) => {
            const hasCuesTrack = song.tracks?.some(t => t.name.trim().toUpperCase() === 'CUES');
            const isAnalyzing = analyzingSongId === song.id;
            return (
              <div key={song.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 group">
                <Music className="w-6 h-6 text-muted-foreground" />
                <div className="flex-grow">
                  <p className="font-semibold text-foreground text-base">{song.name}</p>
                  <p className="text-sm text-muted-foreground">{song.artist}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-primary" onClick={() => setSongToEdit(song)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {hasCuesTrack && (
                    <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-primary" onClick={() => handleReanalyze(song)} disabled={isAnalyzing}>
                      {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-destructive" onClick={() => setSongToDelete(song)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    return <p className="text-muted-foreground text-center py-10">No hay canciones en la biblioteca.</p>;
  };

  return (
    <>
      {songToEdit && (
        <EditSongDialog
          song={songToEdit}
          isOpen={!!songToEdit}
          onClose={() => setSongToEdit(null)}
          onSongUpdated={handleSongUpdated}
        />
      )}
      <AlertDialog open={!!songToDelete} onOpenChange={() => setSongToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción quitará permanentemente la canción <span className="font-bold text-foreground">"{songToDelete?.name}"</span> y todos sus archivos de audio de la biblioteca. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSong} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="h-screen w-full overflow-y-auto">
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-start mb-8">
            <div>
                <h1 className="text-3xl font-bold">Administrador de Canciones</h1>
                <p className="text-muted-foreground">Sube, edita y gestiona toda tu biblioteca de canciones aquí.</p>
            </div>
            <Link href="/" passHref>
                <Button variant="outline" className="gap-2">
                <Home className="w-4 h-4" />
                Ir al Reproductor
                </Button>
            </Link>
            </header>

            <main>
            <div className="flex gap-4 mb-8 border-b">
                <Button 
                    variant="ghost" 
                    onClick={() => setActiveView('library')}
                    className={cn("text-lg pb-3 rounded-none", activeView === 'library' && 'border-b-2 border-primary text-primary')}>
                    <Library className="mr-2 h-5 w-5"/>
                    Biblioteca
                </Button>
                <Button 
                    variant="ghost" 
                    onClick={() => setActiveView('upload')}
                    className={cn("text-lg pb-3 rounded-none", activeView === 'upload' && 'border-b-2 border-primary text-primary')}>
                    <UploadCloud className="mr-2 h-5 w-5"/>
                    Subir Canción
                </Button>
            </div>
            
            {activeView === 'library' && (
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-semibold mb-6">Biblioteca de Canciones</h2>
                    {renderSongLibrary()}
                </div>
            )}

            {activeView === 'upload' && (
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-semibold mb-6">Subir Nueva Canción</h2>
                    <UploadSongForm onUploadFinished={() => handleFetchSongs(true)} />
                </div>
            )}
            </main>
        </div>
      </div>
    </>
  );
};

export default AdminPage;
