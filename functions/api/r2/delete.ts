/**
 * Cloudflare Pages Function: R2 Delete API
 * Replaces REST API calls to api.cloudflare.com/.../r2/buckets/...
 * Uses Native R2 Binding: context.env.STORAGE
 */

interface Env {
  STORAGE: R2Bucket;
  [key: string]: any;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

    const body = (await request.json()) as { paths?: string[] };
    const { paths } = body;

    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(JSON.stringify({ success: true, results: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];
    for (const p of paths) {
      const cleanPath = String(p).replace(/^\/+/, '');
      await env.STORAGE.delete(cleanPath);
      results.push({ path: cleanPath, success: true });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal R2 Delete Error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
