
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from './ui/button';
import { AlignJustify, Library, MoreHorizontal, Music, Loader2, Calendar, X, PlusCircle, DownloadCloud, Trash2, Upload, Globe, ScanSearch, Music2, Hash, Zap, Clock2, Pencil, WifiOff, CheckCircle, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { getSongs, Song } from '@/actions/songs';
import CreateSetlistDialog from './CreateSetlistDialog';
import { getSetlists, Setlist, addSongToSetlist, SetlistSong, removeSongFromSetlist, updateSetlistOrder } from '@/actions/setlists';
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
import EditSetlistDialog from './EditSetlistDialog';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/contexts/AuthContext';


interface SongListProps {
  initialSetlist?: Setlist | null;
  activeSongId: string | null;
  onSetlistSelected: (setlist: Setlist | null) => void;
  onSongSelected: (songId: string) => void;
  onSongsFetched: (songs: Song[]) => void;
  onSongAddedToSetlist: () => void;
  isSongLoading: boolean;
}

type SongToRemove = {
    songId: string;
    songName: string;
}

interface GroupedSong {
    songId: string;
    songName: string;
    tracks: SetlistSong[];
}

const SortableSongItem = ({ songGroup, index, songs, activeSongId, loadingSongId, onSongSelected, onRemove, children }: { songGroup: GroupedSong, index: number, songs: Song[], activeSongId: string | null, loadingSongId: string | null, onSongSelected: (id: string) => void, onRemove: (id: string, name: string) => void, children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: songGroup.songId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    
    const fullSong = songs.find(s => s.id === songGroup.songId);
    const isLoadingThisSong = loadingSongId === songGroup.songId;

    return (
        <div 
            ref={setNodeRef}
            style={style}
            className={cn(
                "grid grid-cols-[auto_20px_1fr_30px_40px_32px] items-center gap-x-2 rounded-md group cursor-pointer",
                "py-1 px-2",
                activeSongId === songGroup.songId ? 'bg-primary/20' : 'hover:bg-accent'
            )}
            onClick={() => onSongSelected(songGroup.songId)}
        >
             <div {...attributes} {...listeners} className="flex items-center justify-center cursor-grab touch-none opacity-60 hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-neutral-400" />
             </div>

            <span className="justify-self-center text-muted-foreground text-[10px] font-mono">{index + 1}.</span>
            
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center shrink-0">
                    {isLoadingThisSong ? (
                        <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    ) : fullSong?.albumImageUrl ? (
                        <Image 
                            src={fullSong.albumImageUrl} 
                            alt={songGroup.songName} 
                            width={24} 
                            height={24} 
                            className="rounded object-cover w-6 h-6"
                        />
                    ) : (
                        <Music2 className="w-3 h-3 text-muted-foreground" />
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-foreground truncate">{songGroup.songName}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{fullSong?.artist}</span>
                </div>
            </div>

            <span className="justify-self-center text-muted-foreground font-mono text-[11px]">{fullSong?.key ?? '-'}</span>
            <span className="justify-self-center text-muted-foreground font-mono text-[11px]">{fullSong?.tempo ?? '--'}</span>

            <div className="flex justify-center items-center">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-7 h-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                        e.stopPropagation(); 
                        onRemove(songGroup.songId, songGroup.songName);
                    }}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
}

const SongList: React.FC<SongListProps> = ({ initialSetlist, activeSongId, onSetlistSelected, onSongSelected, onSongsFetched, onSongAddedToSetlist, isSongLoading }) => {
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [songsError, setSongsError] = useState<string | null>(null);

  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [isLoadingSetlists, setIsLoadingSetlists] = useState(false);
  const [setlistsError, setSetlistsError] = useState<string | null>(null);
  
  const [selectedSetlist, setSelectedSetlist] = useState<Setlist | null>(null);
  const [loadingSongId, setLoadingSongId] = useState<string | null>(null);
  const [setlistToEdit, setSetlistToEdit] = useState<Setlist | null>(null);
  const [isSetlistSheetOpen, setIsSetlistSheetOpen] = useState(false);
  const [isLibrarySheetOpen, setIsLibrarySheetOpen] = useState(false);
  const [songToRemoveFromSetlist, setSongToRemoveFromSetlist] = useState<SongToRemove | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (initialSetlist) {
      setSelectedSetlist(initialSetlist);
    } else {
      setSelectedSetlist(null);
    }
  }, [initialSetlist]);

  // When a song starts loading, set the loading ID. When it finishes, clear it.
  useEffect(() => {
    if (activeSongId) {
        setLoadingSongId(activeSongId);
    }
  }, [activeSongId]);

  useEffect(() => {
      if (!isSongLoading && loadingSongId) {
          setLoadingSongId(null);
      }
  }, [isSongLoading, loadingSongId]);

  const handleFetchSongs = async () => {
    if (!user) return;
    setIsLoadingSongs(true);
    setSongsError(null);
    try {
      const result = await getSongs(user.uid);
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
    if (user) {
        handleFetchSongs();
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleFetchSetlists = async () => {
    if (!user) return;
    setIsLoadingSetlists(true);
    setSetlistsError(null);
    try {
      const result = await getSetlists(user.uid);
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


  const handleAddSongToSetlist = async (song: Song) => {
    if (!selectedSetlist) return;

    const tracksToAdd: SetlistSong[] = song.tracks.map(track => ({
      id: `${song.id}_${track.fileKey}`, 
      name: track.name,
      url: track.url,
      fileKey: track.fileKey,
      songId: song.id, 
      songName: song.name, 
    }));

    const existingSongIds = new Set(selectedSetlist.songs.map(s => s.songId));
    if (existingSongIds.has(song.id)) {
        toast({
            variant: 'destructive',
            title: 'Canción duplicada',
            description: `La canción "${song.name}" ya está en el setlist.`,
        });
        return;
    }
    
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

      onSongAddedToSetlist();
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
            return (
                <div key={song.id} className="flex items-center gap-3 p-2 rounded-md bg-black border border-amber-400/10 hover:border-amber-400/30 group">
                    <Music2 className="w-5 h-5 text-amber-400/60" />
                    <div className="flex-grow">
                        <p className="font-mono font-semibold text-amber-400 [text-shadow:0_0_4px_theme(colors.amber.400)]">{song.name}</p>
                        <p className="text-xs text-amber-400/60 font-mono">{song.artist}</p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
    
    return <p className="text-muted-foreground text-center">No hay canciones en la biblioteca. Ve a la sección de administrador para subir canciones.</p>;
  };

    const getGroupedSongs = (): GroupedSong[] => {
        if (!selectedSetlist) return [];
        
        const songOrder = selectedSetlist.songs.reduce((order, track) => {
            if (track.songId && !order.includes(track.songId)) {
                order.push(track.songId);
            }
            return order;
        }, [] as string[]);
        
        const songsInSetlist = selectedSetlist.songs.reduce((acc, track) => {
            if (track.songId && track.songName) {
                if (!acc[track.songId]) {
                    acc[track.songId] = {
                        songId: track.songId,
                        songName: track.songName,
                        tracks: []
                    };
                }
                acc[track.songId].tracks.push(track);
            }
            return acc;
        }, {} as Record<string, GroupedSong>);

        return songOrder.map(songId => songsInSetlist[songId]).filter(Boolean);
    }

    const groupedSongs = getGroupedSongs();

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!selectedSetlist || !over || active.id === over.id) return;

        const oldIndex = groupedSongs.findIndex(g => g.songId === active.id);
        const newIndex = groupedSongs.findIndex(g => g.songId === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        // Reordenar los grupos de canciones
        const reorderedGroups = [...groupedSongs];
        const [movedItem] = reorderedGroups.splice(oldIndex, 1);
        reorderedGroups.splice(newIndex, 0, movedItem);

        // Aplanar el array de pistas en el nuevo orden
        const newSongsArray = reorderedGroups.flatMap(group => group.tracks);

        const updatedSetlist = {
            ...selectedSetlist,
            songs: newSongsArray,
        };

        // Actualizar el estado local inmediatamente
        setSelectedSetlist(updatedSetlist);
        onSetlistSelected(updatedSetlist);

        // Guardar el nuevo orden en la base de datos en segundo plano
        updateSetlistOrder(selectedSetlist.id, newSongsArray).catch(err => {
            toast({
                variant: 'destructive',
                title: 'Error de sincronización',
                description: 'No se pudo guardar el nuevo orden del setlist.',
            });
            // Opcional: revertir el estado al original si falla el guardado
        });
    }

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
            <div className="grid grid-cols-[auto_20px_1fr_30px_40px_32px] items-center gap-x-2 px-2 py-1 text-xs font-mono text-muted-foreground border-b border-border/50">
                <div />
                <Hash className="w-3 h-3 justify-self-center" />
                <span className="text-left">Canción</span>
                <Zap className="w-3 h-3 justify-self-center" />
                <Clock2 className="w-3 h-3 justify-self-center" />
                <span />
            </div>
            {/* Song Rows */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={groupedSongs.map(g => g.songId)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1 mt-1">
                        {groupedSongs.map((songGroup, index) => (
                           <SortableSongItem
                             key={songGroup.songId}
                             songGroup={songGroup}
                             index={index}
                             songs={songs}
                             activeSongId={activeSongId}
                             loadingSongId={loadingSongId}
                             onSongSelected={onSongSelected}
                             onRemove={(songId, songName) => setSongToRemoveFromSetlist({ songId, songName })}
                           >
                           </SortableSongItem>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
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
        <div className="flex-grow bg-black/80 border border-amber-400/20 rounded-md h-8 flex items-center justify-center px-2 mr-4">
            <span className="font-mono text-sm uppercase text-amber-400 [text-shadow:0_0_8px_theme(colors.amber.400)] truncate">
                {selectedSetlist ? selectedSetlist.name : 'SELECCIONAR SETLIST'}
            </span>
        </div>
        
        <Sheet open={isSetlistSheetOpen} onOpenChange={setIsSetlistSheetOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-primary" onClick={handleFetchSetlists}>
                    <AlignJustify className="w-4 h-4" />
                    Setlists
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
              if (user) {
                handleFetchSongs();
              }
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
