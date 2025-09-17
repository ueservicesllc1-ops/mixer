
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const fileUrl = req.nextUrl.searchParams.get('url');

  if (!fileUrl) {
    return NextResponse.json({ success: false, error: 'URL del archivo no proporcionada' }, { status: 400 });
  }

  try {
    // Realizamos la petición desde el servidor, que no tiene restricciones CORS
    const response = await fetch(fileUrl);

    if (!response.ok) {
      console.error(`Error en el proxy al obtener el archivo: ${response.status} ${response.statusText}`, await response.text());
      return NextResponse.json({ success: false, error: `Error en el servidor al obtener el archivo: ${response.statusText}` }, { status: response.status });
    }

    // Obtenemos el archivo como un Blob
    const blob = await response.blob();

    // Devolvemos el blob directamente.
    // El navegador lo interpretará como un archivo para descargar/cachear.
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');

    return new NextResponse(blob, {
      status: 200,
      headers: headers,
    });

  } catch (error: any) {
    console.error('Error catastrófico en el proxy de descarga:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
