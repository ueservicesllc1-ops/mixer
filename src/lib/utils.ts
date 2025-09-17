import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const blobToDataURI = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
};

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_MAP: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

export const transposeNote = (note: string, semitones: number): string => {
    const normalizedNote = note.charAt(0).toUpperCase() + note.slice(1);
    const noteIndex = NOTE_MAP[normalizedNote];
    
    if (noteIndex === undefined) {
        return note; // Return original note if not found
    }

    const newIndex = (noteIndex + semitones + 12) % 12;

    // Prefer sharp for certain keys, flat for others - a common convention
    if (['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(note) || (note.includes('b') && !note.includes('B'))) {
        return FLAT_NOTES[newIndex];
    }
    
    return SHARP_NOTES[newIndex];
};
