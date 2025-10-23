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

    // Check if user is authorized to download this payload
    const { data: isAuthorized, error: authCheckError } = await serviceSupabase.rpc("compliance.can_download_payload", { 
      p_payload_id: payload_id,
      p_user_id: user.id,
      p_country_code: country || 'US'
    });
    
    if (authCheckError || !isAuthorized) {
      console.error('Authorization check failed:', authCheckError);
      return json({ error: "Access denied" }, 403);
    }

    // Get payload storage URI
    const { data: payloadData, error: payloadError } = await serviceSupabase
      .from('blak.payloads')
      .select('storage_path')
      .eq('id', payload_id)
      .single();
    
    if (payloadError || !payloadData) {
      console.error('Payload not found:', payloadError);
      return json({ error: "Payload not found" }, 404);
    }

    const uri: string = payloadData.storage_path;
    const storageBucket = bucket ?? uri.split("/")[0];
    const objectPath = uri.substring(storageBucket.length + 1);

    // Generate a signed URL (short TTL)
    const { data: urlData, error: urlErr } = await serviceSupabase.storage
      .from(storageBucket)
      .createSignedUrl(objectPath, 60); // 60s

    if (urlErr) {
      console.error('Signed URL generation error:', urlErr);
      return json({ error: 'Failed to generate download URL' }, 400);
    }

    // Note: Access logging removed - table doesn't exist yet
    // TODO: Implement access_log table if audit trail is needed

    return json({ ok: true, signed_url: urlData.signedUrl });
  } catch (e) {
    console.error('Issue signed URL error:', e);
    return json({ error: 'Internal server error' }, 500);
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
