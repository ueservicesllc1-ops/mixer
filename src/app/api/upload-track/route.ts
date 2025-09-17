
import { NextResponse } from 'next/server';
import { uploadFileToB2 } from '@/actions/upload';
import type { TrackFile } from '@/actions/songs';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const trackName = formData.get('trackName') as string;

    if (!file || !trackName) {
      return NextResponse.json({ success: false, error: 'Falta archivo o nombre de pista.' }, { status: 400 });
    }

    const uploadResult = await uploadFileToB2(file);
    if (!uploadResult.success || !uploadResult.url || !uploadResult.fileKey) {
      throw new Error(uploadResult.error || `No se pudo subir el archivo ${file.name}.`);
    }

    const uploadedTrack: TrackFile = {
      name: trackName,
      url: uploadResult.url,
      fileKey: uploadResult.fileKey,
    };
    
    return NextResponse.json({ success: true, track: uploadedTrack });

  } catch (error: any) {
    console.error('Error en el endpoint de subida de pista:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}

    