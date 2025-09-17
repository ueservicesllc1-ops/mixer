
'use server';

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

function getRegionFromEndpoint(endpoint: string | undefined): string {
  if (!endpoint) throw new Error("B2_ENDPOINT is not defined.");
  try {
    const url = new URL(endpoint);
    const region = url.hostname.split('.')[1];
    if (!region) throw new Error('Could not determine region from endpoint');
    return region;
  } catch (error) {
    throw new Error("Invalid B2_ENDPOINT URL.");
  }
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: getRegionFromEndpoint(process.env.B2_ENDPOINT),
      endpoint: process.env.B2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID!,
        secretAccessKey: process.env.B2_APPLICATION_KEY!,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}


// Función para obtener un archivo de B2 como Data URI
export async function getB2FileAsDataURI(fileKey: string): Promise<{ success: boolean, dataUri?: string, error?: string }> {
  const params = {
    Bucket: process.env.B2_BUCKET_NAME,
    Key: fileKey,
  };

  try {
    const client = getS3Client();
    const command = new GetObjectCommand(params);
    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('No body in S3 response.');
    }
    
    // Convertir el stream a un Buffer y luego a un Data URI
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const contentType = response.ContentType || 'application/octet-stream';
    const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;

    return { success: true, dataUri };

  } catch (error) {
    console.error(`Error getting file ${fileKey} as Data URI:`, error);
    return { success: false, error: (error as Error).message };
  }
}
