
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";

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
    if (!process.env.B2_ENDPOINT || !process.env.B2_KEY_ID || !process.env.B2_APPLICATION_KEY) {
        throw new Error("Missing B2 connection environment variables.");
    }
    s3Client = new S3Client({
      region: getRegionFromEndpoint(process.env.B2_ENDPOINT),
      endpoint: process.env.B2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileKey = searchParams.get('fileKey');

  if (!fileKey) {
    return new Response('Missing fileKey parameter', { status: 400 });
  }

  const params = {
    Bucket: process.env.B2_BUCKET_NAME,
    Key: fileKey,
  };

  try {
    const client = getS3Client();
    const command = new GetObjectCommand(params);
    const response = await client.send(command);

    if (!response.Body) {
      return new Response('File not found or empty.', { status: 404 });
    }

    // We can't type response.Body as ReadableStream directly
    // but it behaves like one.
    const stream = response.Body as any;

    // The 'Content-Type' header is important so the browser knows how to handle the file.
    // 'Content-Length' helps the browser show download progress.
    const headers = new Headers();
    if (response.ContentType) {
        headers.set('Content-Type', response.ContentType);
    }
    if (response.ContentLength) {
        headers.set('Content-Length', String(response.ContentLength));
    }
     // These headers are crucial for streaming audio in browsers like Chrome
    headers.set('Accept-Ranges', 'bytes');
    

    // Return a new Response object with the stream from S3.
    // This pipes the data from S3 directly to the client.
    return new Response(stream, {
      status: 200,
      headers: headers,
    });

  } catch (error) {
    console.error(`Error streaming file ${fileKey}:`, error);
    // Use a specific error code if the object does not exist.
    if ((error as any).name === 'NoSuchKey') {
        return new Response('File not found.', { status: 404 });
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}
