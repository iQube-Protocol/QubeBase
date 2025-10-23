// /supabase/functions/issue_signed_url/index.ts
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
    // Create authenticated Supabase client
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

    const { payload_id, country, bucket } = await req.json().catch(() => ({}));
    if (!payload_id) return json({ error: "payload_id required" }, 400);

    // Use service client for privileged operations
    const serviceSupabase = createServiceClient(req);

    // Set request country as a session-local GUC (read by SQL function)
    // This is a convention; implement using Postgres 'set_config' via RPC if needed.
    // For Supabase, we pass it in headers and read it on the SQL side if wired.
    // Here we just forward it for auditing; actual GUC setting handled in SQL/RPC if implemented.

    // Ask DB if user is authorized and get the storage pointer
    const { data, error } = await serviceSupabase.rpc("authorize_payload_download", { 
      p_payload_id: payload_id 
    });
    
    if (error || !data?.length || !data[0]?.ok) {
      return json({ error: "Unauthorized or not found" }, 403);
    }

    const uri: string = data[0].payload_uri;
    const storageBucket = bucket ?? uri.split("/")[0];
    const objectPath = uri.substring(storageBucket.length + 1);

    // Generate a signed URL (short TTL)
    const { data: urlData, error: urlErr } = await serviceSupabase.storage
      .from(storageBucket)
      .createSignedUrl(objectPath, 60); // 60s

    if (urlErr) return json({ error: urlErr.message }, 400);

    // Audit with actual user
    await serviceSupabase.from("access_log").insert({
      actor_user_id: user.id,
      resource: `payload:${payload_id}`,
      decision: "allow",
      reason: `signed:${objectPath}`,
    });

    return json({ ok: true, signed_url: urlData.signedUrl });
  } catch (e) {
    console.error('Issue signed URL error:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function createServiceClient(req: Request) {
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
