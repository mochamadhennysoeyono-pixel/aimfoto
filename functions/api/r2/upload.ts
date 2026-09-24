/**
 * Cloudflare Pages Function: R2 Upload API
 * Replaces REST API calls to api.cloudflare.com/.../r2/buckets/...
 * Uses Native R2 Binding: context.env.STORAGE
 */

interface Env {
  STORAGE: R2Bucket;
  R2_PUBLIC_URL?: string;
  CLOUDFLARE_R2_PUBLIC_URL?: string;
  [key: string]: any;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  try {
    const { request, env } = context;

    if (!env.STORAGE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'R2 binding "STORAGE" is not bound. Please configure R2 binding in Cloudflare Pages Settings -> Functions.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const url = new URL(request.url);
    let filePath = url.searchParams.get('path') || '';
    let contentType = url.searchParams.get('contentType') || 'image/jpeg';
    let fileBuffer: ArrayBuffer | Uint8Array;

    const requestContentType = request.headers.get('content-type') || '';

    if (requestContentType.includes('application/json')) {
      const body = (await request.json()) as any;
      if (body && typeof body.dataUrl === 'string') {
        filePath = body.path || filePath;
        const dataUrl = body.dataUrl;
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          contentType = match[1];
          fileBuffer = base64ToUint8Array(match[2]);
        } else {
          fileBuffer = base64ToUint8Array(dataUrl);
        }
      } else if (body && body.base64) {
        filePath = body.path || filePath;
        contentType = body.contentType || contentType;
        fileBuffer = base64ToUint8Array(body.base64);
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid JSON file payload. Expected dataUrl or base64.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      fileBuffer = await request.arrayBuffer();
    }

    if (!filePath) {
      filePath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    }

    // Clean leading slash
    const cleanPath = filePath.replace(/^\/+/, '');

    // Put directly to R2 bucket using native binding
    await env.STORAGE.put(cleanPath, fileBuffer, {
      httpMetadata: {
        contentType,
      },
    });

    const publicUrlBase =
      env.R2_PUBLIC_URL ||
      env.CLOUDFLARE_R2_PUBLIC_URL ||
      'https://pub-9ab796572b1a43ad87628fe9260ddf61.r2.dev';

    const publicUrl = `${publicUrlBase.replace(/\/+$/, '')}/${cleanPath}`;

    return new Response(
      JSON.stringify({
        success: true,
        key: cleanPath,
        publicUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal R2 Upload Error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
