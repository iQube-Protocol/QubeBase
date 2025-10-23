// /supabase/functions/upload_intake/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

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

    // Read body as text to perform safe JSON parsing
    const raw = await req.text();
    let parsed: any;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // Validation schema
    const uploadSchema = z.object({
      name: z.string().trim().min(1).max(255).optional(),
      description: z.string().trim().max(2000).optional(),
      tenant_id: z.string().uuid(),
      size_bytes: z.number().int().positive().max(HARD),
      mime: z.string().regex(/^[a-z]+\/[a-z0-9+.-]+$/i, 'invalid mime type'),
      storage_uri: z.string().trim().regex(/^[a-z0-9._-]+\/[A-Za-z0-9/_\-.]+$/),
      envelope: z
        .object({ key_ref: z.string().min(1), wrapped_dek: z.string().min(1) })
        .optional(),
    });

    const result = uploadSchema.safeParse(parsed);
    if (!result.success) {
      return json({ error: 'Validation failed', issues: result.error.flatten() }, 422);
    }

    const { name, description, tenant_id, size_bytes, mime, storage_uri } = result.data;

    // Enhanced path validation to prevent traversal
    if (storage_uri.includes('..') || storage_uri.includes('//') || storage_uri.startsWith('/')) {
      return json({ error: 'Invalid storage path' }, 400);
    }

    // Sanitize filename if provided
    const sanitized_name = name ? name.replace(/[^a-zA-Z0-9._\- ]/g, '_').substring(0, 255) : 'Untitled';

    // Validate MIME type matches file extension
    const ext = storage_uri.split('.').pop()?.toLowerCase();
    const allowedMimes: Record<string, string[]> = {
      'jpg': ['image/jpeg'],
      'jpeg': ['image/jpeg'],
      'png': ['image/png'],
      'gif': ['image/gif'],
      'webp': ['image/webp'],
      'pdf': ['application/pdf'],
      'txt': ['text/plain'],
      'json': ['application/json'],
      'csv': ['text/csv'],
      'mp4': ['video/mp4'],
      'webm': ['video/webm'],
      'mp3': ['audio/mpeg'],
      'wav': ['audio/wav'],
      'ogg': ['audio/ogg'],
    };

    if (ext && allowedMimes[ext] && !allowedMimes[ext].includes(mime)) {
      return json({ error: 'MIME type mismatch with file extension' }, 400);
    }

    // Get authenticated user from Bearer token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Missing authorization' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Rate limiting check (100 uploads per tenant per hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count, error: countErr } = await supabase
      .from('payloads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .gte('created_at', oneHourAgo);

    if (countErr) return json({ error: countErr.message }, 500);
    if (count && count > 100) {
      return json({ error: 'Rate limit exceeded. Maximum 100 uploads per hour per tenant.' }, 429);
    }

    // Verify the user belongs to the tenant (has any role in tenant)
    const { data: ur, error: urErr } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id);
    if (urErr) return json({ error: urErr.message }, 400);

    const roleIds = (ur ?? []).map((r: any) => r.role_id);
    if (roleIds.length === 0) return json({ error: 'Forbidden: no roles' }, 403);

    const { data: role, error: rErr } = await supabase
      .from('roles')
      .select('id')
      .in('id', roleIds)
      .eq('tenant_id', tenant_id)
      .maybeSingle();
    if (rErr) return json({ error: rErr.message }, 400);
    if (!role) return json({ error: 'Forbidden: not a member of tenant' }, 403);

    // Enforce hard cap here as well (defense in depth) - size already validated via schema
    if (size_bytes > HARD) return json({ error: `File too large (> ${HARD} bytes)` }, 413);

    // Basic MIME allowlist (defense in depth)
    const allow = ["image/", "video/", "audio/", "application/pdf", "text/"];
    if (!allow.some((p) => mime?.startsWith(p))) {
      return json({ error: "MIME type not allowed" }, 415);
    }

    // Insert payload row with sanitized name
    const { data: payload, error } = await supabase
      .from('payloads')
      .insert({
        tenant_id,
        name: sanitized_name,
        description,
        file_size_bytes: size_bytes,
        content_type: mime,
        storage_path: storage_uri,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 400);

    // Soft-cap advisory
    const note = size_bytes > SOFT ? 'SOFT_CAP_EXCEEDED' : 'OK';
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
