
'use server';
/**
 * @fileOverview Un agente de IA que analiza un archivo de audio de "Cues" y extrae la estructura de la canción.
 *
 * - analyzeSongStructure - Una función que maneja el proceso de análisis de la estructura.
 * - AnalyzeSongStructureInput - El tipo de entrada para la función analyzeSongStructure.
 * - SongStructure (anteriormente AnalyzeSongStructureOutput) - El tipo de retorno para la función analyzeSongStructure.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeSongStructureInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "Un archivo de audio con las pistas de Cues (guías habladas), como un data URI que debe incluir un tipo MIME y usar codificación Base64. Formato esperado: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeSongStructureInput = z.infer<typeof AnalyzeSongStructureInputSchema>;

const CueSchema = z.object({
    label: z.string().describe("La etiqueta de la sección de la canción (ej. 'Intro', 'Verse', 'Chorus')."),
    time: z.number().describe("El tiempo de inicio de esta sección en segundos.")
});

const SongStructureSchema = z.object({
  cues: z.array(CueSchema).describe("Una lista de los marcadores de sección encontrados en el audio."),
});
export type SongStructure = z.infer<typeof SongStructureSchema>;

export async function analyzeSongStructure(input: AnalyzeSongStructureInput): Promise<SongStructure> {
  return analyzeSongStructureFlow(input);
}

const prompt = ai.definePrompt({
  name: 'songStructurePrompt',
  input: {schema: AnalyzeSongStructureInputSchema},
  output: {schema: SongStructureSchema},
  prompt: `You are an expert audio analyst for a multitrack playback application. Your task is to analyze an audio file containing spoken cues (like "Intro", "Verse", "Chorus", "One, two, three, four") and identify the exact start time for each musical section.

  - The audio provided only contains voice commands.
  - You must identify the start of each spoken word or phrase and map it to its timestamp in seconds.
  - Common cues are: Intro, Verse, Chorus, Bridge, Solo, Outro, Interlude, Pre-Chorus. Also, count-ins like "One, Two, Three, Four".
  - The output must be a list of cue objects, each with a "label" and a "time".
  - The "time" should be the precise moment the word begins.
  - Order the cues chronologically based on their start time.
  - If you cannot identify any cues, return an empty list.

  Analyze the following audio file:
  Audio: {{media url=audioDataUri}}`,
});

const analyzeSongStructureFlow = ai.defineFlow(
  {
    name: 'analyzeSongStructureFlow',
    inputSchema: AnalyzeSongStructureInputSchema,
    outputSchema: SongStructureSchema,
  },
  async input => {
    // Usamos un modelo con capacidad de procesar audio largo si es necesario.
    // Gemini 2.5 Flash es una buena opción por su velocidad y ventana de contexto.
    const {output} = await prompt(input);
    return output!;
  }
);
