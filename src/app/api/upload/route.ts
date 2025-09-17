
import { NextResponse } from 'next/server';
import { saveSong } from '@/actions/songs';

export async function POST(req: Request) {
  try {
    // This endpoint is now only for saving the song metadata after tracks are uploaded.
    const songData = await req.json();

    if (!songData.name || !songData.tracks || songData.tracks.length === 0) {
      return NextResponse.json({ success: false, error: 'Faltan datos de la canción o pistas.' }, { status: 400 });
    }
    
    const saveResult = await saveSong(songData);

    if (!saveResult.success || !saveResult.song) {
      return NextResponse.json({ success: false, error: saveResult.error || 'No se pudo guardar la canción en la base de datos.' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, song: saveResult.song });

  } catch (error: any) {
    console.error('Error en el endpoint de guardado de canción:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
