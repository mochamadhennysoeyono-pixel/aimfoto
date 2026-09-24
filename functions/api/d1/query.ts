/**
 * Cloudflare Pages Function: D1 Query API
 * Replaces REST API calls to api.cloudflare.com/.../d1/database/.../query
 * Uses Native D1 Binding: context.env.DB
 */

interface Env {
  DB: D1Database;
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

    if (!env.DB) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'D1 binding "DB" is not bound. Please configure D1 binding in Cloudflare Pages Settings -> Functions.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = (await request.json()) as { sql?: string; params?: any[] };
    const { sql, params } = body;

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'SQL query string is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let stmt = env.DB.prepare(sql);
    if (Array.isArray(params) && params.length > 0) {
      stmt = stmt.bind(...params);
    }

    const trimmedSql = sql.trim().toUpperCase();
    const isSelect = trimmedSql.startsWith('SELECT') || trimmedSql.startsWith('PRAGMA');

    if (isSelect) {
      const queryResult = await stmt.all();
      return new Response(
        JSON.stringify({
          success: true,
          data: queryResult.results || [],
          meta: queryResult.meta || {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      const runResult = await stmt.run();
      return new Response(
        JSON.stringify({
          success: true,
          data: [runResult],
          meta: runResult.meta || {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal D1 Query Execution Error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
