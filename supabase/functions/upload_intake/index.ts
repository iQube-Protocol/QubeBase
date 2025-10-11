// /supabase/functions/upload_intake/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOFT = Number(Deno.env.get("APP_FILE_SOFT_CAP_BYTES") ?? 524288000);   // 500 MB
const HARD = Number(Deno.env.get("APP_FILE_HARD_CAP_BYTES") ?? 1073741824);  // 1 GB

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient(req);

    const body = await req.json().catch(() => ({}));
    const {
      name,
      description,
      tenant_id,
      size_bytes,
      mime,
      storage_uri,
      envelope,  // For future envelope encryption support
    } = body;

    if (!tenant_id || !storage_uri || !size_bytes) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (size_bytes > HARD) return json({ error: `File too large (>${HARD} bytes)` }, 413);

    // Basic MIME allowlist (adjust as needed)
    const allow = ["image/", "video/", "audio/", "application/pdf", "text/"];
    if (!allow.some((p) => mime?.startsWith(p))) {
      return json({ error: "MIME type not allowed" }, 415);
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Insert payload row
    const { data: payload, error } = await supabase
      .from("payloads")
      .insert({
        tenant_id,
        name: name ?? "Untitled",
        description,
        file_size_bytes: size_bytes,
        content_type: mime,
        storage_path: storage_uri,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 400);

    // TODO: Envelope encryption support will be added in Phase 2
    // if (envelope?.key_ref && envelope?.wrapped_dek) { ... }

    // Soft-cap advisory
    const note = size_bytes > SOFT ? "SOFT_CAP_EXCEEDED" : "OK";
    return json({ ok: true, payload_id: payload.id, note }, 201);
  } catch (e) {
    console.error('Upload intake error:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function createServiceClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { 
    global: { headers: { "x-forwarded-for": req.headers.get("cf-connecting-ip") ?? "" } } 
  });
}

function json(body: unknown, status = 200) { 
  return new Response(JSON.stringify(body), { 
    status, 
    headers: { ...corsHeaders, "content-type": "application/json" } 
  }); 
}
