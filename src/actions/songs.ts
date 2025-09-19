
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, doc, deleteDoc, updateDoc, getDoc, where, runTransaction } from 'firebase/firestore';
import { analyzeSongStructure, SongStructure, AnalyzeSongStructureInput } from '@/ai/flows/song-structure';
import { synchronizeLyricsFlow, LyricsSyncInput, LyricsSyncOutput } from '@/ai/flows/lyrics-synchronization';
import { transcribeLyricsFlow, TranscribeLyricsInput } from '@/ai/flows/transcribe-lyrics';
import { deleteFileFromB2 } from './upload';
import { TRIAL_SONG_LIMIT, TRIAL_SONG_LIMIT_ERROR } from '@/lib/constants';


// Represents a single track file within a song
export interface TrackFile {
  name: string;
  url: string;
  fileKey: string;
  handle?: FileSystemFileHandle; // Para el acceso local en modo escritorio
}

// Represents the new Song entity, which is a collection of tracks and metadata
export interface NewSong {
  name: string;
  artist: string;
  tempo: number;
  key:string;
  timeSignature: string;
  tracks: TrackFile[];
  userId: string;
  albumImageUrl?: string;
  lyrics?: string;
  youtubeUrl?: string;
  syncOffset?: number;
}

export interface Song extends NewSong {
    id: string;
    createdAt?: string;
    structure?: SongStructure;
    syncedLyrics?: LyricsSyncOutput;
}

export interface SongUpdateData {
  name?: string;
  artist?: string;
  lyrics?: string;
  youtubeUrl?: string;
  syncOffset?: number;
}


const toTitleCase = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};


export async function saveSong(data: NewSong) {
  try {
    const userRef = doc(db, 'users', data.userId);
    
    // First, check the user's limit without a transaction to return a specific error code.
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
        return { success: false, error: "El usuario no existe." };
    }
    const userData = userDoc.data();
    const userRole = userData.role || 'trial';
    const songsUploadedCount = userData.songsUploadedCount || 0;

    if (userRole === 'trial' && songsUploadedCount >= TRIAL_SONG_LIMIT) {
        return { success: false, error: TRIAL_SONG_LIMIT_ERROR };
    }

    // If limit is not reached, proceed with the transaction
    const songsCollection = collection(db, 'songs');

    // Remove non-serializable 'handle' from tracks before saving to Firestore
    const tracksToSave = data.tracks.map(({ handle, ...rest }) => rest);

    const formattedData = {
        ...data,
        name: toTitleCase(data.name),
        artist: toTitleCase(data.artist),
        syncOffset: data.syncOffset || 0,
        tracks: tracksToSave,
        createdAt: serverTimestamp(),
    };
    
    const newDocRef = doc(songsCollection); // Generate a new doc ref with an ID
    
    await runTransaction(db, async (transaction) => {
        // We re-get the user doc inside the transaction to ensure data consistency
        const freshUserDoc = await transaction.get(userRef);
        const freshUserData = freshUserDoc.data()!;
        const freshSongsUploadedCount = freshUserData.songsUploadedCount || 0;

        // The check is repeated inside the transaction to prevent race conditions
        if ((freshUserData.role || 'trial') === 'trial' && freshSongsUploadedCount >= TRIAL_SONG_LIMIT) {
            // This time we throw to abort the transaction
            throw new Error(TRIAL_SONG_LIMIT_ERROR);
        }

        transaction.set(newDocRef, formattedData);
        transaction.update(userRef, { songsUploadedCount: freshSongsUploadedCount + 1 });
    });
    
    const songData: Song = {
      id: newDocRef.id,
      ...data // Return original data with the handle for client-side use
    }
    
    // Trigger structure analysis in the background
    runStructureAnalysisOnUpload(newDocRef.id, data.tracks);

    return { success: true, song: songData };

  } catch (error) {
    console.error('Error guardando en Firestore:', error);
    const errorMessage = (error as Error).message;
    // Propagate the trial limit error if the transaction was aborted
    if (errorMessage === TRIAL_SONG_LIMIT_ERROR) {
      return { success: false, error: TRIAL_SONG_LIMIT_ERROR };
    }
    return { success: false, error: errorMessage };
  }
}

export async function updateSong(songId: string, data: SongUpdateData) {
  try {
    const songRef = doc(db, 'songs', songId);

    const formattedData: SongUpdateData = {};
    if (data.name !== undefined) formattedData.name = toTitleCase(data.name);
    if (data.artist !== undefined) formattedData.artist = toTitleCase(data.artist);
    if (data.lyrics !== undefined) formattedData.lyrics = data.lyrics;
    if (data.youtubeUrl !== undefined) formattedData.youtubeUrl = data.youtubeUrl;
    if (data.syncOffset !== undefined) formattedData.syncOffset = data.syncOffset;

    await updateDoc(songRef, formattedData);

    // Fetch the updated document to return it
    const updatedDoc = await getDoc(songRef);
    if (!updatedDoc.exists()) {
        throw new Error('Could not find song after update.');
    }
    const updatedSongData = updatedDoc.data();
    
    // Aquí no tenemos acceso a los handles, pero el cliente los mantendrá en su estado.
    const updatedSong: Song = {
        id: updatedDoc.id,
        ...updatedSongData,
        createdAt: updatedSongData.createdAt?.toDate ? updatedSongData.createdAt.toDate().toISOString() : new Date().toISOString(),
    } as Song;


    return { success: true, song: updatedSong };
  } catch (error) {
    console.error(`Error actualizando la canción ${songId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

async function runStructureAnalysisOnUpload(songId: string, tracks: TrackFile[]) {
    try {
        const cuesTrack = tracks.find(t => t.name.trim().toUpperCase() === 'CUES' || t.name.trim().toUpperCase() === 'GUIA' || t.name.trim().toUpperCase() === 'GUIDES' || t.name.trim().toUpperCase() === 'GUIDE');
        if (cuesTrack) {
            console.log(`Iniciando análisis de estructura para la canción ${songId}...`);
            
            let audioDataUri = cuesTrack.url;
            // Si tenemos el handle, lo usamos para leer el archivo localmente y evitar la descarga
            if (cuesTrack.handle) {
                 try {
                    const file = await cuesTrack.handle.getFile();
                    const reader = new FileReader();
                    audioDataUri = await new Promise((resolve, reject) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                } catch (e) {
                    console.warn("No se pudo leer el handle para el análisis, se usará la URL de descarga.", e);
                }
            }
            
            const structure = await analyzeSongStructure({ audioDataUri });
            
            const songRef = doc(db, 'songs', songId);
            await updateDoc(songRef, { structure });
            console.log(`Estructura guardada para la canción ${songId}.`);
            return structure;
        } else {
            console.log(`No se encontró pista 'CUES' para la canción ${songId}. No se analizará la estructura.`);
            return null;
        }
    } catch (error) {
        console.error(`Error al analizar la estructura de la canción ${songId}:`, error);
        // No devolvemos error al cliente, es un proceso de fondo.
        throw error;
    }
}

// Esta es la nueva función que se llamará desde el cliente con el Data URI
export async function reanalyzeSongStructure(songId: string, input: AnalyzeSongStructureInput): Promise<{ success: boolean; structure?: SongStructure, error?: string }> {
    try {
        console.log(`Iniciando re-análisis de estructura para la canción ${songId} desde el cliente...`);
        const structure = await analyzeSongStructure(input);
        
        const songRef = doc(db, 'songs', songId);
        await updateDoc(songRef, { structure });
        
        console.log(`Estructura re-analizada y guardada para la canción ${songId}.`);
        return { success: true, structure };
        
    } catch (error) {
        console.error(`Error al re-analizar la estructura de la canción ${songId}:`, error);
        return { success: false, error: (error as Error).message };
    }
}


export async function getSongs(userId: string) {
    try {
        const songsCollection = collection(db, 'songs');
        const q = query(songsCollection, where('userId', '==', userId));
        const songsSnapshot = await getDocs(q);
        
        const songs: Song[] = songsSnapshot.docs.map(doc => {
            const data = doc.data();
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();

            // Los handles no se guardan en la DB, así que aquí no estarán.
            // Se deben mantener en el estado del cliente.
            return {
                id: doc.id,
                name: toTitleCase(data.name),
                artist: toTitleCase(data.artist),
                tempo: data.tempo,
                key: data.key,
                timeSignature: data.timeSignature,
                tracks: data.tracks || [],
                userId: data.userId,
                structure: data.structure,
                albumImageUrl: data.albumImageUrl,
                lyrics: data.lyrics,
                youtubeUrl: data.youtubeUrl,
                syncedLyrics: data.syncedLyrics,
                syncOffset: data.syncOffset || 0,
                createdAt: createdAt,
            };
        });

        // Sort manually after fetching to avoid composite index requirement
        songs.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

        return { success: true, songs };
    } catch (error) {
        console.error("Error obteniendo canciones de Firestore:", error);
        return { success: false, error: (error as Error).message, songs: [] };
    }
}

export async function deleteSong(song: Song) {
    try {
        // Primero, eliminar todos los archivos de audio asociados en B2
        if (song.tracks && song.tracks.length > 0) {
            const deletePromises = song.tracks.map(track => deleteFileFromB2(track.fileKey));
            await Promise.all(deletePromises);
        }

        // Luego, eliminar el documento de Firestore
        const songRef = doc(db, 'songs', song.id);
        await deleteDoc(songRef);
        
        // Opcional: Decrementar el contador del usuario. Decidimos no hacerlo para evitar abuso.

        return { success: true };
    } catch (error) {
        console.error("Error eliminando la canción de la biblioteca:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function transcribeLyrics(songId: string, input: TranscribeLyricsInput): Promise<{ success: boolean; song?: Song, error?: string }> {
    try {
        console.log(`Iniciando transcripción de letra para la canción ${songId}...`);
        const { lyrics } = await transcribeLyricsFlow(input);
        
        const songRef = doc(db, 'songs', songId);
        await updateDoc(songRef, { lyrics });

        const updatedDoc = await getDoc(songRef);
        if (!updatedDoc.exists()) {
            throw new Error('No se encontró la canción después de la transcripción.');
        }

        const updatedSongData = updatedDoc.data();
        const updatedSong: Song = {
            id: updatedDoc.id,
            ...updatedSongData,
            createdAt: updatedSongData.createdAt?.toDate ? updatedSongData.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Song;
        
        console.log(`Letra transcrita y guardada para la canción ${songId}.`);
        return { success: true, song: updatedSong };
        
    } catch (error) {
        console.error(`Error al transcribir la letra de la canción ${songId}:`, error);
        return { success: false, error: (error as Error).message };
    }
}


export async function synchronizeLyrics(songId: string, input: LyricsSyncInput): Promise<{ success: boolean; song?: Song, error?: string }> {
    try {
        console.log(`Iniciando sincronización de letra para la canción ${songId}...`);
        const syncedLyrics = await synchronizeLyricsFlow(input);
        
        const songRef = doc(db, 'songs', songId);
        await updateDoc(songRef, { syncedLyrics });
        
        const updatedDoc = await getDoc(songRef);
        if (!updatedDoc.exists()) {
            throw new Error('No se encontró la canción después de la sincronización.');
        }

        const updatedSongData = updatedDoc.data();
        const updatedSong: Song = {
            id: updatedDoc.id,
            ...updatedSongData,
            createdAt: updatedSongData.createdAt?.toDate ? updatedSongData.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Song;
        
        console.log(`Letra sincronizada y guardada para la canción ${songId}.`);
        return { success: true, song: updatedSong };
        
    } catch (error) {
        console.error(`Error al sincronizar la letra de la canción ${songId}:`, error);
        return { success: false, error: (error as Error).message };
    }
}

    