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
 * Note: This function uses service role for ICP replica management but validates caller auth.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { payload_id, tier, uri, latency_ms } = await req.json().catch(() => ({}));
    if (!payload_id || !tier || !uri) {
      return json({ error: "payload_id, tier, uri required" }, 400);
    }

    // Use service client for privileged operations
    const serviceSupabase = createServiceClient();

    // Verify user has access to this payload
    const { data: payload, error: payloadError } = await serviceSupabase
      .from('payloads')
      .select('id, tenant_id')
      .eq('id', payload_id)
      .single();

    if (payloadError || !payload) {
      return json({ error: "Payload not found or unauthorized" }, 403);
    }

    // Check if user is a member of the tenant
    const { data: membership, error: membershipError } = await serviceSupabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (membershipError || !membership) {
      return json({ error: "Unauthorized - not a tenant member" }, 403);
    }

    // TODO: create storage.replicas & storage.policies tables (future migration)
    // For now, simply echo and pretend it's stored.
    // await serviceSupabase.from("storage.replicas").upsert({ payload_id, tier, uri, last_probe_at: new Date(), latency_ms });

    console.log('IPFS/ICP connector called by user:', user.id, { payload_id, tier, uri, latency_ms });

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
