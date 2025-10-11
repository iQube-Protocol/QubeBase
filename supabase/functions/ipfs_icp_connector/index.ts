// /supabase/functions/ipfs_icp_connector/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Phase-2 connector stub.
 * Accepts a request to create/update storage replicas and tracks probe latency.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const { payload_id, tier, uri, latency_ms } = await req.json().catch(() => ({}));
    if (!payload_id || !tier || !uri) {
      return json({ error: "payload_id, tier, uri required" }, 400);
    }

    // TODO: create storage.replicas & storage.policies tables (future migration)
    // For now, simply echo and pretend it's stored.
    // await supabase.from("storage.replicas").upsert({ payload_id, tier, uri, last_probe_at: new Date(), latency_ms });

    console.log('IPFS/ICP connector called:', { payload_id, tier, uri, latency_ms });

    return json({ ok: true, echoed: { payload_id, tier, uri, latency_ms } });
  } catch (e) {
    console.error('IPFS/ICP connector error:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!, 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function json(body: unknown, status = 200) { 
  return new Response(JSON.stringify(body), { 
    status, 
    headers: { ...corsHeaders, "content-type": "application/json" } 
  }); 
}
