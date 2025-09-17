
'use server';
// This file is no longer needed as we are using a direct server action.
// It is kept to prevent breaking changes if it was referenced elsewhere,
// but it will now return an error indicating it's deprecated.

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    return new Response('This endpoint is deprecated. Please use server actions for downloads.', { status: 410 });
}
