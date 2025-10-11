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
    const event = await req.json();
    // TODO: verify signature / HMAC
    // Example payload shapes (adjust to your actual webhook):
    // { type: 'template.upsert', template: { id, name, meta_public } }
    // { type: 'instance.upsert',  instance: { id, template_id, owner_tenant_id, meta_public, black_pointer, tokenqube_key_id } }
    // { type: 'proof.append',     proof: { instance_id, txid, chain, block_height, proof_type, signature } }

    switch (event?.type) {
      case "template.upsert": {
        const { error } = await supabase.from("templates").upsert(event.template);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case "instance.upsert": {
        const { error } = await supabase.from("instances").upsert(event.instance);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case "proof.append": {
        const { error } = await supabase.from("proofs").insert(event.proof);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case "entitlement.grant": {
        const { error } = await supabase.from("entitlements").insert(event.entitlement);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      default:
        return json({ error: "unknown event" }, 400);
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
