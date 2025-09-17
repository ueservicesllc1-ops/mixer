
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { analyzeSongStructure, SongStructure, AnalyzeSongStructureInput } from '@/ai/flows/song-structure';
import { synchronizeLyricsFlow, LyricsSyncInput, LyricsSyncOutput } from '@/ai/flows/lyrics-synchronization';
import { transcribeLyricsFlow, TranscribeLyricsInput } from '@/ai/flows/transcribe-lyrics';


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
  key: string;
  timeSignature: string;
  tracks: TrackFile[];
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
    const songsCollection = collection(db, 'songs');

    // Remove non-serializable 'handle' from tracks before saving to Firestore
    const tracksToSave = data.tracks.map(({ handle, ...rest }) => rest);

    const formattedData = {
        ...data,
        name: toTitleCase(data.name),
        artist: toTitleCase(data.artist),
        syncOffset: data.syncOffset || 0,
        tracks: tracksToSave
    };
    
    const newDoc = await addDoc(songsCollection, {
      ...formattedData,
      createdAt: serverTimestamp(),
    });

    const songData: Song = {
      id: newDoc.id,
      ...data // Devolvemos la data original con el handle para el cliente
    }
    
    // Disparar el análisis de estructura en segundo plano
    runStructureAnalysisOnUpload(newDoc.id, data.tracks);

    return { success: true, song: songData };
  } catch (error) {
    console.error('Error guardando en Firestore:', error);
    return { success: false, error: (error as Error).message };
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
        const cuesTrack = tracks.find(t => t.name.trim().toUpperCase() === 'CUES');
        if (cuesTrack) {
            console.log(`Iniciando análisis de estructura para la canción ${songId}...`);
            // El análisis se hace con la URL pública, ya que el audio puede no estar en caché aún
            const structure = await analyzeSongStructure({ audioDataUri: cuesTrack.url });
            
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


export async function getSongs() {
    try {
        const songsCollection = collection(db, 'songs');
        const q = query(songsCollection, orderBy('createdAt', 'desc'));
        const songsSnapshot = await getDocs(q);
        
        const songs: Song[] = songsSnapshot.docs.map(doc => {
            const data = doc.data();
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();

            return {
                id: doc.id,
                name: toTitleCase(data.name),
                artist: toTitleCase(data.artist),
                tempo: data.tempo,
                key: data.key,
                timeSignature: data.timeSignature,
                tracks: data.tracks || [],
                structure: data.structure,
                albumImageUrl: data.albumImageUrl,
                lyrics: data.lyrics,
                youtubeUrl: data.youtubeUrl,
                syncedLyrics: data.syncedLyrics,
                syncOffset: data.syncOffset || 0,
                createdAt: createdAt,
            };
        });

        return { success: true, songs };
    } catch (error) {
        console.error("Error obteniendo canciones de Firestore:", error);
        return { success: false, error: (error as Error).message, songs: [] };
    }
}

export async function deleteSong(song: Song) {
    try {
        // We only delete the document from Firestore, not the files from B2.
        const songRef = doc(db, 'songs', song.id);
        await deleteDoc(songRef);

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
