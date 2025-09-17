
'use server';
/**
 * @fileOverview Un agente de IA que transcribe la letra de una canción a partir de un archivo de audio.
 *
 * - transcribeLyricsFlow - Una función que maneja el proceso de transcripción de letras.
 * - TranscribeLyricsInput - El tipo de entrada para la función.
 * - TranscribeLyricsOutput - El tipo de retorno para la función.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscribeLyricsInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "El archivo de audio de la canción completa, como un data URI que debe incluir un tipo MIME y usar codificación Base64. Formato esperado: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeLyricsInput = z.infer<typeof TranscribeLyricsInputSchema>;

const TranscribeLyricsOutputSchema = z.object({
  lyrics: z.string().describe("La letra completa de la canción transcrita del audio."),
});
export type TranscribeLyricsOutput = z.infer<typeof TranscribeLyricsOutputSchema>;


export async function transcribeLyricsFlow(input: TranscribeLyricsInput): Promise<TranscribeLyricsOutput> {

  const prompt = ai.definePrompt({
    name: 'transcribeLyricsPrompt',
    input: {schema: TranscribeLyricsInputSchema},
    output: {schema: TranscribeLyricsOutputSchema},
    prompt: `You are an expert audio analyst specializing in lyrics transcription.
    Your task is to accurately transcribe the entire song from the provided audio file.
    - Pay close attention to punctuation and line breaks to make the lyrics readable.
    - The output should be a single string containing the full lyrics.
    
    Analyze the following audio file and return the lyrics:
    Audio: {{media url=audioDataUri}}
    `,
  });

  const { output } = await prompt(input);
  return output!;
}
