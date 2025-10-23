// /supabase/functions/registry_webhook/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

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
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return json({ error: 'Invalid JSON payload' }, 400);
    }

    // Validate event structure with Zod schemas
    const templateEventSchema = z.object({
      type: z.literal('template.upsert'),
      template: z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
        meta_public: z.record(z.unknown()).optional(),
      })
    });

    const instanceEventSchema = z.object({
      type: z.literal('instance.upsert'),
      instance: z.object({
        id: z.string().uuid(),
        template_id: z.string().uuid().optional(),
        owner_tenant_id: z.string().uuid().optional(),
        meta_public: z.record(z.unknown()).optional(),
        blak_pointer: z.string().uuid().optional(),
        tokenqube_key_id: z.string().optional(),
      })
    });

    const proofEventSchema = z.object({
      type: z.literal('proof.append'),
      proof: z.object({
        id: z.string().uuid(),
        instance_id: z.string().uuid(),
        txid: z.string().min(1),
        chain: z.string().min(1),
        block_height: z.number().int().positive().optional(),
        proof_type: z.string().min(1),
        signature: z.string().optional(),
      })
    });

    const entitlementEventSchema = z.object({
      type: z.literal('entitlement.grant'),
      entitlement: z.object({
        id: z.string().uuid(),
        instance_id: z.string().uuid(),
        tenant_id: z.string().uuid(),
        expires_at: z.string().datetime().optional(),
        meta: z.record(z.unknown()).optional(),
      })
    });

    // Validate based on event type
    let validatedEvent;
    try {
      switch (event?.type) {
        case 'template.upsert':
          validatedEvent = templateEventSchema.parse(event);
          break;
        case 'instance.upsert':
          validatedEvent = instanceEventSchema.parse(event);
          break;
        case 'proof.append':
          validatedEvent = proofEventSchema.parse(event);
          break;
        case 'entitlement.grant':
          validatedEvent = entitlementEventSchema.parse(event);
          break;
        default:
          return json({ error: 'Unknown event type' }, 400);
      }
    } catch (validationError) {
      console.error('Validation error:', validationError);
      return json({ error: 'Invalid event data format' }, 400);
    }

    switch (validatedEvent.type) {
      case 'template.upsert': {
        const { error } = await supabase.from('templates').upsert(validatedEvent.template);
        if (error) {
          console.error('Template upsert error:', error);
          return json({ error: 'Failed to process template' }, 400);
        }
        break;
      }
      case 'instance.upsert': {
        const { error } = await supabase.from('instances').upsert(validatedEvent.instance);
        if (error) {
          console.error('Instance upsert error:', error);
          return json({ error: 'Failed to process instance' }, 400);
        }
        break;
      }
      case 'proof.append': {
        const { error } = await supabase.from('proofs').insert(validatedEvent.proof);
        if (error) {
          console.error('Proof insert error:', error);
          return json({ error: 'Failed to process proof' }, 400);
        }
        break;
      }
      case 'entitlement.grant': {
        const { error } = await supabase.from('entitlements').insert(validatedEvent.entitlement);
        if (error) {
          console.error('Entitlement insert error:', error);
          return json({ error: 'Failed to process entitlement' }, 400);
        }
        break;
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error('Registry webhook error:', e);
    return json({ error: 'Internal server error' }, 500);
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
