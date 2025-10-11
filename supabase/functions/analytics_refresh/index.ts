// /supabase/functions/analytics_refresh/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Supabase does not expose direct SQL via the HTTP function by default.
    // Two options:
    //   1) Create a SECURITY DEFINER RPC like 'ops.refresh_views' that does REFRESH MATERIALIZED VIEW concurrently.
    //   2) Use a connection string (service role) with a DB client (not recommended in edge function without driver).
    // For stub purposes, just return OK.
    // TODO: add RPC 'ops.refresh_views' and call it here.
    console.log('Analytics refresh called - add ops.refresh_views RPC to implement');
    return json({ ok: true, note: "Add ops.refresh_views RPC and invoke it here." });
  } catch (e) {
    console.error('Analytics refresh error:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) { 
  return new Response(JSON.stringify(body), { 
    status, 
    headers: { ...corsHeaders, "content-type": "application/json" } 
  }); 
}
