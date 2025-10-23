// /supabase/functions/generate_derivatives/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { payload_id } = await req.json().catch(() => ({}));
    if (!payload_id) return json({ error: "payload_id required" }, 400);

    // Use service client for privileged operations
    const serviceSupabase = createServiceClient(req);

    // Verify user has access to this payload by checking if they can read it
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

    // TODO: fetch payload, perform policy check for server-side decrypt, generate previews.
    // Placeholder: create a dummy derivative row pointing to a placeholder asset.
    const { error } = await serviceSupabase.from("derivatives").insert({
      payload_id,
      kind: "preview",
      uri: "blakqube/previews/placeholder.jpg",
      width: 640, 
      height: 360, 
      duration_s: null,
    });
    
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e) {
    console.error('Generate derivatives error:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function createServiceClient(_req: Request) {
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
