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
      instance_id,
      tenant_id,
      site_id,
      class_: className, // 'sensitive' | 'standard'
      size_bytes,
      mime,
      storage_uri,       // client-proposed path: e.g., 'blakqube/<uuid>/<filename>'
      envelope,          // { key_ref, wrapped_dek, alg, version }
    } = body;

    if (!instance_id || !tenant_id || !storage_uri || !size_bytes) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (size_bytes > HARD) return json({ error: `File too large (>${HARD} bytes)` }, 413);

    // Basic MIME allowlist (adjust as needed)
    const allow = ["image/", "video/", "audio/", "application/pdf", "text/"];
    if (!allow.some((p) => mime?.startsWith(p))) {
      return json({ error: "MIME type not allowed" }, 415);
    }

    // Insert payload row (encrypted blobs assumed; this just registers metadata)
    const { data: payload, error } = await supabase
      .from("payloads")
      .insert({
        instance_id,
        tenant_id,
        site_id,
        class: className ?? "standard",
        size_bytes,
        storage_tier: "central_object",
        uri: storage_uri,
        pii_tag: false,
        jurisdiction_tags: [],
        status: "active",
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 400);

    // Optional: save envelope for the uploader (subject could be user/tenant)
    if (envelope?.key_ref && envelope?.wrapped_dek) {
      const { error: envErr } = await supabase.from("envelopes").insert({
        payload_id: payload.id,
        subject_type: "tenant", // or 'user'/'persona' depending on your flow
        subject_id: tenant_id,
        key_ref: envelope.key_ref,
        wrapped_dek: envelope.wrapped_dek,
        alg: envelope.alg ?? "AES-256-GCM",
        version: envelope.version ?? 1,
      });
      if (envErr) return json({ error: envErr.message }, 400);
    }

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
