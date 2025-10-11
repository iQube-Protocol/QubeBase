// generate_derivatives - Thumbnail and preview generation
// Responsibilities:
// - Ephemeral server-side decrypt (if policy allows)
// - Generate thumbnails for images
// - Generate first-frame/preview clips for videos
// - Write black.derivatives

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const body = await req.json()
    const { payload_id, kinds } = body // kinds: ['thumbnail', 'preview', 'low_res']

    if (!payload_id) {
      throw new Error('Missing payload_id')
    }

    // Get payload metadata
    const { data: payload, error: payloadError } = await supabase
      .from('payloads')
      .select('*, assets!inner(*)')
      .eq('id', payload_id)
      .single()

    if (payloadError || !payload) {
      throw new Error('Payload not found')
    }

    // Check if user has permission to generate derivatives
    // (must have write access to tenant)
    const { data: membership } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', payload.tenant_id)
      .single()

    if (!membership || !['uber_admin', 'franchise_admin', 'site_admin', 'editor'].includes(membership.role)) {
      throw new Error('Insufficient permissions')
    }

    const derivatives = []
    const requestedKinds = kinds || ['thumbnail']

    // TODO: Actual image/video processing
    // For now, create placeholder derivative records
    for (const kind of requestedKinds) {
      let width = null, height = null, duration_s = null
      
      if (kind === 'thumbnail') {
        width = 320
        height = 240
      } else if (kind === 'preview') {
        duration_s = 10 // First 10 seconds
      }

      const derivativeUri = `${payload.uri}_${kind}`

      const { data: derivative, error: derivError } = await supabase
        .from('derivatives')
        .insert({
          payload_id: payload.id,
          kind,
          uri: derivativeUri,
          width,
          height,
          duration_s
        })
        .select()
        .single()

      if (derivError) {
        console.error(`Error creating ${kind} derivative:`, derivError)
        continue
      }

      derivatives.push(derivative)
      
      // TODO: Actual processing steps:
      // 1. Download original from storage
      // 2. If encrypted (class='sensitive'), ephemeral decrypt using service key
      // 3. Generate derivative (resize, clip, etc.)
      // 4. Upload derivative to storage
      // 5. Update derivative URI
      
      console.log(`Generated ${kind} derivative (placeholder)`, { derivative_id: derivative.id })
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        payload_id,
        derivatives: derivatives.map(d => ({ id: d.id, kind: d.kind, uri: d.uri }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Generate derivatives error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
