/**
 * Cloudflare Pages Function: Health Check API
 * Verifies that Pages Functions can access required D1 & R2 bindings
 */

interface Env {
  DB?: D1Database;
  STORAGE?: R2Bucket;
  [key: string]: any;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const { env } = context;

  const hasD1 = Boolean(env.DB);
  const hasR2 = Boolean(env.STORAGE);

  return new Response(
    JSON.stringify({
      status: 'ok',
      provider: 'cloudflare-pages-functions',
      timestamp: new Date().toISOString(),
      bindings: {
        d1_database: hasD1 ? 'bound' : 'missing',
        r2_storage: hasR2 ? 'bound' : 'missing',
      },
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
};
