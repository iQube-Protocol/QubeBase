// registry_webhook - DVN/ICP template and instance sync
// Responsibilities:
// - Verify DVN/ICP signatures (TODO: actual verification)
// - Upsert registry_mirror.templates/instances/proofs/entitlements
// - Idempotency via txid or instance_id
// - Refresh materialized views

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
}

interface WebhookPayload {
  type: 'template' | 'instance' | 'proof' | 'entitlement'
  data: any
  txid?: string
  signature?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get('X-Webhook-Signature')
    // TODO: Actual DVN/ICP signature verification
    // For now, just log and proceed
    console.log('Webhook signature (not verified):', signature)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload: WebhookPayload = await req.json()
    const { type, data, txid } = payload

    // Idempotency check - if txid exists, check if already processed
    if (txid) {
      const { data: existing } = await supabase
        .from('proofs')
        .select('id')
        .eq('txid', txid)
        .maybeSingle()

      if (existing) {
        console.log('Webhook already processed (idempotent)', { txid })
        return new Response(
          JSON.stringify({ success: true, message: 'Already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    let result
    switch (type) {
      case 'template':
        result = await upsertTemplate(supabase, data)
        break
      case 'instance':
        result = await upsertInstance(supabase, data)
        break
      case 'proof':
        result = await upsertProof(supabase, data, txid)
        break
      case 'entitlement':
        result = await upsertEntitlement(supabase, data)
        break
      default:
        throw new Error(`Unknown webhook type: ${type}`)
    }

    console.log(`Webhook processed: ${type}`, { result })

    return new Response(
      JSON.stringify({ success: true, type, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Registry webhook error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function upsertTemplate(supabase: any, data: any) {
  const { id, name, meta_public } = data
  
  const { data: template, error } = await supabase
    .from('templates')
    .upsert({ id, name, meta_public }, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  return template
}

async function upsertInstance(supabase: any, data: any) {
  const { id, template_id, owner_tenant_id, meta_public, black_pointer, tokenqube_key_id } = data
  
  const { data: instance, error } = await supabase
    .from('instances')
    .upsert({ 
      id, 
      template_id, 
      owner_tenant_id, 
      meta_public: meta_public || {}, 
      black_pointer,
      tokenqube_key_id
    }, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  return instance
}

async function upsertProof(supabase: any, data: any, txid?: string) {
  const { instance_id, chain, block_height, proof_type, signature } = data
  
  const { data: proof, error } = await supabase
    .from('proofs')
    .insert({ 
      instance_id, 
      chain, 
      txid: txid || data.txid, 
      block_height, 
      proof_type, 
      signature 
    })
    .select()
    .single()

  if (error) throw error
  return proof
}

async function upsertEntitlement(supabase: any, data: any) {
  const { subject_type, subject_id, instance_id, rights, expiry, provenance } = data
  
  const { data: entitlement, error } = await supabase
    .from('entitlements')
    .insert({ 
      subject_type, 
      subject_id, 
      instance_id, 
      rights, 
      expiry,
      provenance: provenance || {}
    })
    .select()
    .single()

  if (error) throw error
  return entitlement
}
