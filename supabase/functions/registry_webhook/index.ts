// /supabase/functions/registry_webhook/index.ts
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

  const supabase = createServiceClient();

  try {
    // HMAC signature verification (protects against spoofed calls)
    const secret = Deno.env.get('WEBHOOK_SECRET');
    if (!secret) {
      console.error('WEBHOOK_SECRET is not set');
      return json({ error: 'Server misconfigured' }, 500);
    }

    const ts = req.headers.get('X-Webhook-Timestamp') ?? '';
    const sig = req.headers.get('X-Webhook-Signature') ?? '';

    // Basic header checks
    if (!ts || !sig) return json({ error: 'missing signature headers' }, 401);

    // Prevent replay attacks (5 min window)
    const now = Math.floor(Date.now() / 1000);
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > 300) {
      return json({ error: 'stale or invalid timestamp' }, 401);
    }

    // Read raw body for signature computation
    const rawBody = await req.text();

    // Compute expected signature: HMAC_SHA256(secret, `${ts}.${rawBody}`)
    const expected = await (async () => {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${rawBody}`));
      return new Uint8Array(mac);
    })();

    const provided = (() => {
      // Signature expected as hex string
      const clean = sig.trim().toLowerCase();
      if (!/^[0-9a-f]+$/.test(clean)) return null;
      const bytes = new Uint8Array(clean.length / 2);
      for (let i = 0; i < clean.length; i += 2) {
        bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
      }
      return bytes;
    })();

    if (!provided || provided.length !== expected.length) {
      return json({ error: 'invalid signature' }, 401);
    }

    // Constant-time comparison
    let ok = 0;
    for (let i = 0; i < expected.length; i++) ok |= expected[i] ^ provided[i];
    if (ok !== 0) return json({ error: 'invalid signature' }, 401);

    // Parse JSON only after signature is verified
    const event = JSON.parse(rawBody);

    switch (event?.type) {
      case 'template.upsert': {
        const { error } = await supabase.from('templates').upsert(event.template);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case 'instance.upsert': {
        const { error } = await supabase.from('instances').upsert(event.instance);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case 'proof.append': {
        const { error } = await supabase.from('proofs').insert(event.proof);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case 'entitlement.grant': {
        const { error } = await supabase.from('entitlements').insert(event.entitlement);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      default:
        return json({ error: 'unknown event' }, 400);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('Registry webhook error:', e);
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
