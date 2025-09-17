
'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from './ui/button';
import { AlignJustify, Library, MoreHorizontal, Music, Loader2, Calendar, X, PlusCircle, DownloadCloud, Trash2, Upload, Globe, ScanSearch, Music2, Hash, Zap, Clock2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSongs, Song, deleteSong, reanalyzeSongStructure } from '@/actions/songs';
import CreateSetlistDialog from './CreateSetlistDialog';
import { getSetlists, Setlist, addSongToSetlist, SetlistSong, removeSongFromSetlist } from '@/actions/setlists';
import { format } from 'date-fns';
import { useToast } from './ui/use-toast';
import UploadSongDialog from './UploadSongDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { blobToDataURI } from '@/lib/utils';
import EditSongDialog from './EditSongDialog';


interface SongListProps {
  initialSetlist?: Setlist | null;
  activeSongId: string | null;
  onSetlistSelected: (setlist: Setlist | null) => void;
  onSongSelected: (songId: string) => void;
  onSongsFetched: (songs: Song[]) => void;
}

type SongToRemove = {
    songId: string;
    songName: string;
}

const SongList: React.FC<SongListProps> = ({ initialSetlist, activeSongId, onSetlistSelected, onSongSelected, onSongsFetched }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [songsError, setSongsError] = useState<string | null>(null);

  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [isLoadingSetlists, setIsLoadingSetlists] = useState(false);
  const [setlistsError, setSetlistsError] = useState<string | null>(null);
  
  const [selectedSetlist, setSelectedSetlist] = useState<Setlist | null>(null);
  const [isSetlistSheetOpen, setIsSetlistSheetOpen] = useState(false);
  const [isLibrarySheetOpen, setIsLibrarySheetOpen] = useState(false);
  const [isLibrarySheetForEditingOpen, setIsLibrarySheetForEditingOpen] = useState(false);
  const [isEditingSetlist, setIsEditingSetlist] = useState(false);
  const [showLibraryInEdit, setShowLibraryInEdit] = useState(false);
  const [songToEdit, setSongToEdit] = useState<Song | null>(null);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analyzingSongId, setAnalyzingSongId] = useState<string | null>(null);
  const [songToRemoveFromSetlist, setSongToRemoveFromSetlist] = useState<SongToRemove | null>(null);
  const { toast } = useToast();


  useEffect(() => {
    if (initialSetlist) {
      setSelectedSetlist(initialSetlist);
    } else {
      setSelectedSetlist(null);
    }
  }, [initialSetlist]);

  const handleFetchSongs = async () => {
    setIsLoadingSongs(true);
    setSongsError(null);
    try {
      const result = await getSongs();
      if (result.success && result.songs) {
        setSongs(result.songs);
        onSongsFetched(result.songs); // Notificar al padre sobre las canciones
      } else {
        setSongsError(result.error || 'No se pudieron cargar las canciones.');
      }
    } catch (err) {
      setSongsError('Ocurrió un error al buscar las canciones.');
    } finally {
      setIsLoadingSongs(false);
    }
  };
  
  // Cargar canciones al montar el componente
  useEffect(() => {
    handleFetchSongs();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetchSetlists = async () => {
    setIsLoadingSetlists(true);
    setSetlistsError(null);
    // NOTA: El userId está hardcodeado. Se deberá reemplazar con el del usuario autenticado.
    const userId = 'user_placeholder_id'; 
    try {
      const result = await getSetlists(userId);
      if (result.success && result.setlists) {
        setSetlists(result.setlists);
      } else {
        setSetlistsError(result.error || 'No se pudieron cargar los setlists.');
      }
    } catch (err) {
      setSetlistsError('Ocurrió un error al buscar los setlists.');
    } finally {
      setIsLoadingSetlists(false);
    }
  };

  const handleSetlistSelect = (setlist: Setlist) => {
    onSetlistSelected(setlist);
    setIsSetlistSheetOpen(false);
  }

  const clearSelectedSetlist = () => {
    onSetlistSelected(null);
  }

  const handleSongUpdated = (updatedSong: Song) => {
    const updatedSongs = songs.map(s => s.id === updatedSong.id ? updatedSong : s);
    setSongs(updatedSongs);
    onSongsFetched(updatedSongs);
    setSongToEdit(null); // Cierra el diálogo de edición
  };

  const handleAddSongToSetlist = async (song: Song) => {
    if (!selectedSetlist) return;

    // Cuando se añade una canción (que es un grupo de pistas),
    // se añaden todas sus pistas al setlist.
    const tracksToAdd: SetlistSong[] = song.tracks.map(track => ({
      id: `${song.id}_${track.fileKey}`, // Genera un ID único para la pista en el setlist
      name: track.name,
      url: track.url,
      fileKey: track.fileKey,
      songId: song.id, // Referencia a la canción padre
      songName: song.name, // Nombre de la canción padre
    }));

    // Prevenir duplicados
    const existingSongIds = new Set(selectedSetlist.songs.map(s => s.songId));
    if (existingSongIds.has(song.id)) {
        toast({
            variant: 'destructive',
            title: 'Canción duplicada',
            description: `La canción "${song.name}" ya está en el setlist.`,
        });
        return;
    }
    
    // Iterar y añadir cada pista individualmente
    let allAdded = true;
    for (const track of tracksToAdd) {
        const result = await addSongToSetlist(selectedSetlist.id, track);
        if (!result.success) {
            allAdded = false;
            toast({
                variant: 'destructive',
                title: 'Error',
                description: result.error || `No se pudo añadir la pista "${track.name}".`,
            });
            break; 
        }
    }

    if (allAdded) {
      const updatedSetlist = {
        ...selectedSetlist,
        songs: [...selectedSetlist.songs, ...tracksToAdd]
      };
      onSetlistSelected(updatedSetlist);
      setSelectedSetlist(updatedSetlist);
      
      toast({
        title: '¡Canción añadida!',
        description: `"${song.name}" se ha añadido a "${selectedSetlist.name}".`,
      });
    }
  };
  
  const handleRemoveSongFromSetlist = async (songId: string, songName: string) => {
    if (!selectedSetlist) return;

    const tracksToRemove = selectedSetlist.songs.filter(s => s.songId === songId);
    if (tracksToRemove.length === 0) return;

    let allRemoved = true;
    for(const track of tracksToRemove) {
      const result = await removeSongFromSetlist(selectedSetlist.id, track);
      if(!result.success) {
        allRemoved = false;
        toast({
            variant: 'destructive',
            title: 'Error al eliminar',
            description: result.error || `No se pudo quitar la pista "${track.name}".`,
        });
        break;
      }
    }

    if (allRemoved) {
        const updatedSongs = selectedSetlist.songs.filter(s => s.songId !== songId);
        const updatedSetlist = { ...selectedSetlist, songs: updatedSongs };

        onSetlistSelected(updatedSetlist);
        setSelectedSetlist(updatedSetlist);

        toast({
            title: 'Canción eliminada',
            description: `"${songName}" se ha quitado del setlist.`,
        });
    }
  };

  const confirmRemoveSongFromSetlist = () => {
    if (songToRemoveFromSetlist) {
        handleRemoveSongFromSetlist(songToRemoveFromSetlist.songId, songToRemoveFromSetlist.songName);
        setSongToRemoveFromSetlist(null);
    }
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
        // Remove from local state for instant feedback
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
    if (!song.tracks || song.tracks.length === 0) {
      toast({ variant: 'destructive', title: 'Sin pistas', description: `"${song.name}" no tiene pistas para analizar.`});
      return;
    }

    const cuesTrack = song.tracks.find(t => t.name.trim().toUpperCase() === 'CUES');
    if (!cuesTrack) {
        toast({ variant: 'destructive', title: 'Sin pista de Cues', description: `"${song.name}" no tiene una pista llamada 'CUES'.`});
        return;
    }

    setAnalyzingSongId(song.id);
    toast({ title: 'Iniciando análisis...', description: 'Descargando pista de Cues para el análisis.' });

    try {
        // Since the audio cache now stores ArrayBuffers, and we need a Blob to create a Data URI,
        // it's simpler and more reliable to just fetch the file directly for analysis.
        // Cues tracks are small, so this should be fast.
        const response = await fetch(`/api/download?url=${encodeURIComponent(cuesTrack.url)}`);
        if (!response.ok) throw new Error('Failed to download Cues track for analysis.');
        const audioBlob = await response.blob();
        
        const audioDataUri = await blobToDataURI(audioBlob);

        const result = await reanalyzeSongStructure(song.id, { audioDataUri });
        if (result.success && result.structure) {
            toast({
                title: 'Análisis completado',
                description: `Se ha analizado la estructura de "${song.name}".`,
            });
            const updatedSongs = songs.map(s => 
                s.id === song.id ? { ...s, structure: result.structure } : s
            );
            setSongs(updatedSongs);
            onSongsFetched(updatedSongs);
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


  const renderSongLibrary = (forGlobal: boolean = false) => {
    if (isLoadingSongs) {
      return (
        <div className="flex justify-center items-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (songsError) {
      return <div className="text-destructive text-center">{songsError}</div>;
    }

    const librarySongs = forGlobal ? songs.slice(0,5) : songs; // Example: show only first 5 for global

    if (librarySongs.length > 0) {
      return (
        <div className="space-y-2">
          {librarySongs.map((song) => {
            const hasCuesTrack = song.tracks && song.tracks.some(t => t.name.trim().toUpperCase() === 'CUES');
            const isAnalyzing = analyzingSongId === song.id;

            return (
                <div key={song.id} className="flex items-center gap-3 p-2 rounded-md bg-black border border-amber-400/10 hover:border-amber-400/30 group">
                    <Music2 className="w-5 h-5 text-amber-400/60" />
                    <div className="flex-grow">
                        <p className="font-mono font-semibold text-amber-400 [text-shadow:0_0_4px_theme(colors.amber.400)]">{song.name}</p>
                        <p className="text-xs text-amber-400/60 font-mono">{song.artist}</p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!forGlobal && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-8 h-8 text-muted-foreground hover:text-primary"
                                onClick={() => setSongToEdit(song)}
                            >
                                <Pencil className="w-4 h-4" />
                            </Button>
                        )}
                        {hasCuesTrack && !forGlobal && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-8 h-8 text-muted-foreground hover:text-primary"
                                onClick={() => handleReanalyze(song)}
                                disabled={isAnalyzing}
                            >
                                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                            </Button>
                        )}

                        {!forGlobal && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-8 h-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setSongToDelete(song)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}

                        {selectedSetlist && (
                            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleAddSongToSetlist(song)}>
                                <PlusCircle className="w-5 h-5 text-primary" />
                            </Button>
                        )}
                    </div>
                </div>
            );
          })}
        </div>
      );
    }
    
    return <p className="text-muted-foreground text-center">No hay canciones en la biblioteca.</p>;
  };

  const getGroupedSongs = () => {
    if (!selectedSetlist) return [];
    const songsInSetlist = selectedSetlist.songs.reduce((acc, track) => {
        if (track.songId && track.songName) {
            const songId = track.songId;
            if (!acc[songId]) {
                acc[songId] = {
                    songId: songId,
                    songName: track.songName,
                    tracks: []
                };
            }
            acc[songId].tracks.push(track);
        }
        return acc;
    }, {} as Record<string, { songId: string; songName: string; tracks: SetlistSong[] }>);

    return Object.values(songsInSetlist);
  }

  const groupedSongs = getGroupedSongs();

  const renderSetlist = () => {
    if (!selectedSetlist) return null;

    if (groupedSongs.length === 0) {
        return (
            <div className="text-center pt-10 text-muted-foreground">
                <p>Este setlist no tiene canciones.</p>
                <Button 
                  variant="link" 
                  className="text-primary mt-2" 
                  onClick={() => {
                    handleFetchSongs();
                    setIsLibrarySheetForEditingOpen(true);
                  }}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Añadir canciones
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            {/* Header */}
            <div className="grid grid-cols-[30px_1fr_40px_50px_32px] items-center gap-x-3 px-2 py-1 text-xs font-medium text-muted-foreground border-b border-border/50">
                <Hash className="w-3 h-3 justify-self-center" />
                <span>Nombre</span>
                <Zap className="w-3 h-3 justify-self-center" />
                <Clock2 className="w-3 h-3 justify-self-center" />
                <span />
            </div>
            {/* Song Rows */}
            <div className="space-y-1 mt-1">
                {groupedSongs.map((songGroup, index) => {
                    const fullSong = songs.find(s => s.id === songGroup.songId);

                    return (
                        <div 
                            key={songGroup.songId} 
                            className={cn(
                                "grid grid-cols-[30px_1fr_40px_50px_32px] items-center gap-x-3 rounded-md group cursor-pointer",
                                "py-1 text-sm",
                                activeSongId === songGroup.songId ? 'bg-primary/20' : 'hover:bg-accent'
                            )}
                            onClick={() => onSongSelected(songGroup.songId)}
                        >
                            <span className="justify-self-center text-foreground text-base">{index + 1}</span>
                            
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center shrink-0">
                                    {fullSong?.albumImageUrl ? (
                                        <Image 
                                            src={fullSong.albumImageUrl} 
                                            alt={songGroup.songName} 
                                            width={28} 
                                            height={28} 
                                            className="rounded object-cover w-7 h-7"
                                        />
                                    ) : (
                                        <Music2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    )}
                                </div>
                                <span className="font-semibold text-foreground truncate">{songGroup.songName}</span>
                            </div>

                            <span className="justify-self-center text-foreground font-medium">{fullSong?.key ?? '-'}</span>
                            <span className="justify-self-center text-foreground font-medium">{fullSong?.tempo ?? '--'}</span>

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-8 h-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    setSongToRemoveFromSetlist({ songId: songGroup.songId, songName: songGroup.songName });
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    )
                })}
            </div>
        </div>
    );
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
                Esta acción quitará la canción <span className="font-bold text-foreground">"{songToDelete?.name}"</span> de la biblioteca.
                No se eliminará el archivo de audio, por lo que podrá ser añadido de nuevo más tarde si es necesario.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSong} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sí, quitar de la biblioteca
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!songToRemoveFromSetlist} onOpenChange={() => setSongToRemoveFromSetlist(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta acción quitará la canción <span className="font-bold text-foreground">"{songToRemoveFromSetlist?.songName}"</span> del setlist actual.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveSongFromSetlist} className="bg-destructive hover:bg-destructive/90">
                Sí, quitar
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <div className="bg-card/50 rounded-lg p-3 flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-foreground">{selectedSetlist ? selectedSetlist.name : 'Nuevas betel'}</h2>
        
        <Sheet open={isSetlistSheetOpen} onOpenChange={setIsSetlistSheetOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-primary" onClick={handleFetchSetlists}>
                    <AlignJustify className="w-4 h-4" />
                    {selectedSetlist ? 'Setlists' : 'Setlists'}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[600px] sm:w-[700px] bg-card/95">
                <SheetHeader>
                    <SheetTitle>Setlists</SheetTitle>
                    <SheetDescription>
                        Elige un setlist existente o crea uno nuevo.
                    </SheetDescription>
                </SheetHeader>
                <div className="py-4 h-full flex flex-col">
                    <div className="flex-grow space-y-2">
                    {isLoadingSetlists ? (
                        <div className="flex justify-center items-center h-full">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : setlistsError ? (
                        <div className="text-destructive text-center">{setlistsError}</div>
                    ) : setlists.length > 0 ? (
                        setlists.map((setlist) => (
                        <div 
                          key={setlist.id} 
                          className="flex flex-col p-3 rounded-md bg-black border border-amber-400/20 gap-1 cursor-pointer hover:bg-gray-900/50" 
                          onClick={() => handleSetlistSelect(setlist)}
                        >
                            <p className="font-mono font-bold text-lg text-amber-400 flex-grow [text-shadow:0_0_5px_theme(colors.amber.400)]">
                              {setlist.name}
                            </p>
                            <div className="flex items-center gap-2 text-amber-400/60">
                              <Calendar className="w-4 h-4" />
                              <p className="text-xs font-mono">{format(new Date(setlist.date), 'dd/MM/yyyy')}</p>
                            </div>
                        </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground text-center pt-10">Aún no has creado un setlist.</p>
                    )}
                    </div>
                    <CreateSetlistDialog onSetlistCreated={handleFetchSetlists} />
                </div>
            </SheetContent>
        </Sheet>
      </div>
      <div className="flex-grow space-y-1 overflow-y-auto no-scrollbar">
        {selectedSetlist ? renderSetlist() : <p className="text-muted-foreground text-center pt-10">Selecciona un setlist para ver las canciones.</p>}
      </div>
        <div className="pt-3 mt-auto border-t border-border/50 flex justify-between items-center">
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-2" onClick={() => {
              handleFetchSongs();
              setIsLibrarySheetOpen(true);
            }}>
                <Library className="w-4 h-4" />
                Biblioteca
            </Button>

            {selectedSetlist && (
                 <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground" 
                    onClick={() => {
                        setShowLibraryInEdit(false); // Reset state on open
                        setIsEditingSetlist(true)}
                    }
                 >
                    Editar setlist
                </Button>
            )}
        </div>

      <Sheet open={isLibrarySheetOpen} onOpenChange={setIsLibrarySheetOpen}>
        <SheetContent side="left" className="w-[600px] sm:w-[700px] bg-card/95 p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>Biblioteca de Canciones</SheetTitle>
            <SheetDescription>
                Gestiona tus canciones o explora la biblioteca global.
            </SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="local" className="h-full flex flex-col pt-2">
            <TabsList className="mx-4">
              <TabsTrigger value="local" className="gap-2"><Library className="w-4 h-4" /> Biblioteca Local</TabsTrigger>
              <TabsTrigger value="global" className="gap-2"><Globe className="w-4 h-4"/> Biblioteca Global</TabsTrigger>
            </TabsList>
            
            <TabsContent value="local" className="flex-grow overflow-y-auto px-4">
                <div className="flex justify-between items-center my-4">
                  <h3 className="font-semibold">Biblioteca de Canciones</h3>
                  <UploadSongDialog onUploadFinished={handleFetchSongs} />
                </div>
                {renderSongLibrary()}
            </TabsContent>

            <TabsContent value="global" className="flex-grow overflow-y-auto px-4">
                <div className="flex justify-between items-center my-4">
                  <h3 className="font-semibold">Biblioteca Global</h3>
                </div>
                {renderSongLibrary(true)}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <Sheet open={isLibrarySheetForEditingOpen} onOpenChange={setIsLibrarySheetForEditingOpen}>
        <SheetContent side="left" className="w-[600px] sm:w-[700px] bg-card/95 p-0">
            <SheetHeader className="p-4 pb-0">
                <SheetTitle>Añadir Canciones a "{selectedSetlist?.name}"</SheetTitle>
                <SheetDescription>
                Explora tus bibliotecas y añade canciones al setlist activo.
                </SheetDescription>
            </SheetHeader>
            <Tabs defaultValue="local" className="flex flex-col h-full pt-2">
            <TabsList className="mx-4">
                <TabsTrigger value="local" className="gap-2"><Library className="w-4 h-4" /> Biblioteca Local</TabsTrigger>
                <TabsTrigger value="global" className="gap-2"><Globe className="w-4 h-4"/> Biblioteca Global</TabsTrigger>
            </TabsList>
            <TabsContent value="local" className="flex-grow overflow-y-auto px-4">
                <div className="flex justify-between items-center my-4">
                <h3 className="font-semibold">Biblioteca de Canciones</h3>
                <UploadSongDialog onUploadFinished={handleFetchSongs} />
                </div>
                {renderSongLibrary()}
            </TabsContent>
            <TabsContent value="global" className="flex-grow overflow-y-auto px-4">
                <div className="flex justify-between items-center my-4">
                <h3 className="font-semibold">Biblioteca Global</h3>
                </div>
                {renderSongLibrary(true)}
            </TabsContent>
            </Tabs>
        </SheetContent>
      </Sheet>

      <Sheet open={isEditingSetlist} onOpenChange={setIsEditingSetlist}>
        <SheetContent side="right" className="w-3/4 max-w-none bg-card/95 p-0">
            <SheetHeader className="p-6">
                <SheetTitle>Editando: {selectedSetlist?.name}</SheetTitle>
            </SheetHeader>
            <div className={cn("grid h-full grid-rows-[1fr_auto] transition-all", showLibraryInEdit ? "grid-cols-3" : "grid-cols-2")}>
                 {/* Columna Izquierda: Detalles del Setlist */}
                <div className="flex flex-col gap-4 p-6 border-r border-border/50">
                     <div className="aspect-square w-1/2 rounded-lg bg-secondary overflow-hidden">
                        <Image
                            src="https://picsum.photos/seed/setlist1/600/600"
                            width={600}
                            height={600}
                            alt={selectedSetlist?.name ?? 'Setlist'}
                            className="object-cover w-full h-full"
                            data-ai-hint="abstract music"
                        />
                    </div>
                    <div className="rounded-md bg-black border border-amber-400/20 p-4 flex-grow">
                        <p className="font-mono font-bold text-2xl text-amber-400 flex-grow [text-shadow:0_0_8px_theme(colors.amber.400)]">
                            {selectedSetlist?.name}
                        </p>
                        <div className="flex items-center gap-2 text-amber-400/60 mt-2">
                            <Calendar className="w-4 h-4" />
                            <p className="text-sm font-mono">{selectedSetlist ? format(new Date(selectedSetlist.date), 'PPP') : ''}</p>
                        </div>
                    </div>
                </div>

                 {/* Columna Central: Canciones del Setlist */}
                <div className="flex flex-col gap-4 p-6 border-r border-border/50">
                    <div className='flex justify-between items-center'>
                        <h4 className="font-semibold">Canciones en el Setlist</h4>
                        <Button onClick={() => setShowLibraryInEdit(prev => !prev)} variant="outline" size="sm" className="gap-2">
                            <PlusCircle className="w-4 h-4" />
                            {showLibraryInEdit ? 'Cerrar Biblioteca' : 'Añadir Canciones'}
                        </Button>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-2 no-scrollbar">
                        {groupedSongs.length > 0 ? groupedSongs.map((songGroup, index) => (
                             <div key={songGroup.songId} className="flex items-center gap-3 p-2 rounded-md bg-black border border-amber-400/10">
                                <span className="font-mono text-sm text-amber-400/50">{index + 1}</span>
                                <div className="flex-grow">
                                    <p className="font-mono font-semibold text-amber-400 [text-shadow:0_0_4px_theme(colors.amber.400)]">{songGroup.songName}</p>
                                    <p className="text-xs text-amber-400/60 font-mono">{songs.find(s => s.id === songGroup.songId)?.artist}</p>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-8 h-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setSongToRemoveFromSetlist({songId: songGroup.songId, songName: songGroup.songName})}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                             </div>
                        )) : (
                            <div className="text-center py-10 text-muted-foreground">
                                <p>Aún no hay canciones.</p>
                                <p>Haz clic en "Añadir Canciones" para empezar.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Biblioteca de canciones (condicional) */}
                {showLibraryInEdit && (
                    <div className="flex flex-col h-full">
                        <Tabs defaultValue="local" className="flex flex-col h-full pt-2">
                            <TabsList className="mx-4">
                                <TabsTrigger value="local" className="gap-2"><Library className="w-4 h-4" /> Local</TabsTrigger>
                                <TabsTrigger value="global" className="gap-2"><Globe className="w-4 h-4"/> Global</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="local" className="flex-grow overflow-y-auto px-4 mt-0">
                                <div className="flex justify-between items-center my-4">
                                <h3 className="font-semibold">Biblioteca Local</h3>
                                <UploadSongDialog onUploadFinished={handleFetchSongs} />
                                </div>
                                {renderSongLibrary()}
                            </TabsContent>

                            <TabsContent value="global" className="flex-grow overflow-y-auto px-4 mt-0">
                                <div className="flex justify-between items-center my-4">
                                <h3 className="font-semibold">Biblioteca Global</h3>
                                </div>
                                {renderSongLibrary(true)}
                            </TabsContent>
                        </Tabs>
                    </div>
                )}

            </div>
        </SheetContent>
      </Sheet>

    </div>
    </>
  );
};

export default SongList;
