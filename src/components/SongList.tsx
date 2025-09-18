
'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from './ui/button';
import { AlignJustify, Library, MoreHorizontal, Music, Loader2, Calendar, X, PlusCircle, DownloadCloud, Trash2, Upload, Globe, ScanSearch, Music2, Hash, Zap, Clock2, Pencil, WifiOff, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { getSongs, Song } from '@/actions/songs';
import CreateSetlistDialog from './CreateSetlistDialog';
import { getSetlists, Setlist, addSongToSetlist, SetlistSong, removeSongFromSetlist } from '@/actions/setlists';
import { format } from 'date-fns';
import { useToast } from './ui/use-toast';
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
import { cacheArrayBuffer, getCachedArrayBuffer } from '@/lib/audiocache';
import EditSetlistDialog from './EditSetlistDialog';


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
  const [setlistToEdit, setSetlistToEdit] = useState<Setlist | null>(null);
  const [isSetlistSheetOpen, setIsSetlistSheetOpen] = useState(false);
  const [isLibrarySheetOpen, setIsLibrarySheetOpen] = useState(false);
  const [songToRemoveFromSetlist, setSongToRemoveFromSetlist] = useState<SongToRemove | null>(null);
  const [cachingSongs, setCachingSongs] = useState<Record<string, boolean>>({});
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

  const handleSetlistUpdated = () => {
    handleFetchSetlists();
    // También podría ser necesario actualizar el setlist activo si es el que se editó
    if (setlistToEdit && selectedSetlist && setlistToEdit.id === selectedSetlist.id) {
        // Refrescar el setlist activo. Esto es una simplificación, una mejor
        // implementación podría devolver el setlist actualizado desde la acción.
    }
    setSetlistToEdit(null);
  };


  const preCacheSongTracks = async (song: Song) => {
    setCachingSongs(prev => ({ ...prev, [song.id]: true }));

    const cachingPromises = song.tracks.map(async (track) => {
        try {
            const isCached = await getCachedArrayBuffer(track.fileKey);
            if (isCached) return; // Ya está en caché, no hacer nada

            const response = await fetch(`/api/download-stream?fileKey=${encodeURIComponent(track.fileKey)}`);
            if (!response.ok) throw new Error(`Fallo al descargar ${track.name}`);
            const arrayBuffer = await response.arrayBuffer();
            await cacheArrayBuffer(track.fileKey, arrayBuffer);
        } catch (error) {
            console.error(`Error pre-cargando la pista ${track.name}:`, error);
            throw error; // Propaga el error para que Promise.all lo capture
        }
    });

    try {
        await Promise.all(cachingPromises);
        toast({
            title: `¡"${song.name}" está lista!`,
            description: 'Todas las pistas han sido guardadas en el caché.',
            action: <CheckCircle className="text-green-500" />
        });
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error de Preparación',
            description: `No se pudieron guardar todas las pistas de "${song.name}" en el caché.`,
        });
    } finally {
        setCachingSongs(prev => ({ ...prev, [song.id]: false }));
    }
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
    
    // Inicia el pre-cacheo en segundo plano SIN esperar a que termine
    preCacheSongTracks(song);
    
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

  const renderSongLibrary = () => {
    if (isLoadingSongs) {
      return (
        <div className="flex justify-center items-center h-full">
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
            const isCaching = cachingSongs[song.id];

            return (
                <div key={song.id} className="flex items-center gap-3 p-2 rounded-md bg-black border border-amber-400/10 hover:border-amber-400/30 group">
                    <Music2 className="w-5 h-5 text-amber-400/60" />
                    <div className="flex-grow">
                        <p className="font-mono font-semibold text-amber-400 [text-shadow:0_0_4px_theme(colors.amber.400)]">{song.name}</p>
                        <p className="text-xs text-amber-400/60 font-mono">{song.artist}</p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         {selectedSetlist && (
                            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleAddSongToSetlist(song)} disabled={isCaching}>
                                {isCaching ? <Loader2 className="w-5 h-5 animate-spin"/> : <PlusCircle className="w-5 h-5 text-primary" />}
                            </Button>
                        )}
                    </div>
                </div>
            );
          })}
        </div>
      );
    }
    
    return <p className="text-muted-foreground text-center">No hay canciones en la biblioteca. Ve a la sección de administrador para subir canciones.</p>;
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
                    setIsLibrarySheetOpen(true);
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
                <span>Canción / Artista</span>
                <Zap className="w-3 h-3 justify-self-center" />
                <Clock2 className="w-3 h-3 justify-self-center" />
                <span />
            </div>
            {/* Song Rows */}
            <div className="space-y-1 mt-1">
                {groupedSongs.map((songGroup, index) => {
                    const fullSong = songs.find(s => s.id === songGroup.songId);
                    const isCaching = cachingSongs[songGroup.songId];

                    return (
                        <div 
                            key={songGroup.songId} 
                            className={cn(
                                "grid grid-cols-[30px_1fr_40px_50px_32px] items-center gap-x-3 rounded-md group cursor-pointer",
                                "py-2 text-sm",
                                activeSongId === songGroup.songId ? 'bg-primary/20' : 'hover:bg-accent'
                            )}
                            onClick={() => onSongSelected(songGroup.songId)}
                        >
                            <span className="justify-self-center text-muted-foreground text-xs">{index + 1}</span>
                            
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                                    {fullSong?.albumImageUrl ? (
                                        <Image 
                                            src={fullSong.albumImageUrl} 
                                            alt={songGroup.songName} 
                                            width={32} 
                                            height={32} 
                                            className="rounded object-cover w-8 h-8"
                                        />
                                    ) : (
                                        <Music2 className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-sm text-foreground truncate">{songGroup.songName}</span>
                                  <span className="text-xs text-muted-foreground truncate">{fullSong?.artist}</span>
                                </div>
                            </div>

                            <span className="justify-self-center text-muted-foreground font-medium text-xs">{fullSong?.key ?? '-'}</span>
                            <span className="justify-self-center text-muted-foreground font-medium text-xs">{fullSong?.tempo ?? '--'}</span>

                            <div className="flex justify-center items-center">
                                {isCaching ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                ) : (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="w-8 h-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation(); 
                                            setSongToRemoveFromSetlist({ songId: songGroup.songId, songName: songGroup.songName });
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};


  return (
    <>
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

    {setlistToEdit && (
        <EditSetlistDialog
            setlist={setlistToEdit}
            isOpen={!!setlistToEdit}
            onClose={() => setSetlistToEdit(null)}
            onSetlistUpdated={handleSetlistUpdated}
        />
    )}

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
                    <div className="flex-grow space-y-2 overflow-y-auto">
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
                          className="flex items-center p-3 rounded-md bg-black border border-amber-400/20 gap-4 group" 
                        >
                            <div className="flex-grow cursor-pointer" onClick={() => handleSetlistSelect(setlist)}>
                                <p className="font-mono font-bold text-lg text-amber-400 flex-grow [text-shadow:0_0_5px_theme(colors.amber.400)]">
                                {setlist.name}
                                </p>
                                <div className="flex items-center gap-2 text-amber-400/60">
                                <Calendar className="w-4 h-4" />
                                <p className="text-xs font-mono">{format(new Date(setlist.date), 'dd/MM/yyyy')}</p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-9 h-9 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100"
                                onClick={() => setSetlistToEdit(setlist)}
                            >
                                <Pencil className="w-4 h-4"/>
                            </Button>
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
                <PlusCircle className="w-4 h-4" />
                Añadir Canciones
            </Button>
        </div>

      <Sheet open={isLibrarySheetOpen} onOpenChange={setIsLibrarySheetOpen}>
        <SheetContent side="left" className="w-[600px] sm:w-[700px] bg-card/95 p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>Añadir Canciones a "{selectedSetlist?.name}"</SheetTitle>
            <SheetDescription>
                Explora tu biblioteca de canciones y añádelas al setlist activo.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-grow overflow-y-auto px-4 mt-4">
            {renderSongLibrary()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </>
  );
};

export default SongList;
