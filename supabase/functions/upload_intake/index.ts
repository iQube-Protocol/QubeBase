// upload_intake - File upload with cap enforcement
// Responsibilities:
// - Enforce 25 MB soft / 250 MB hard caps
// - MIME/virus checks (TODO: integrate virus scanner)
// - Read client-side envelope metadata
// - Write black.payloads, black.chunks, media.assets

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SOFT_CAP_BYTES = parseInt(Deno.env.get('APP_FILE_SOFT_CAP_BYTES') || '26214400') // 25 MB
const HARD_CAP_BYTES = parseInt(Deno.env.get('APP_FILE_HARD_CAP_BYTES') || '262144000') // 250 MB

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const body = await req.json()
    const { tenant_id, instance_id, class: fileClass, size_bytes, mime_type, uri, envelope } = body

    // Validate required fields
    if (!tenant_id || !instance_id || !fileClass || !size_bytes || !uri) {
      throw new Error('Missing required fields: tenant_id, instance_id, class, size_bytes, uri')
    }

    // Enforce hard cap
    if (size_bytes > HARD_CAP_BYTES) {
      return new Response(
        JSON.stringify({ error: `File exceeds hard cap of ${HARD_CAP_BYTES} bytes (250 MB)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Warn on soft cap (but allow)
    let warning = null
    if (size_bytes > SOFT_CAP_BYTES) {
      warning = `File exceeds soft cap of ${SOFT_CAP_BYTES} bytes (25 MB) but is within hard cap`
      console.warn(warning, { size_bytes })
    }

    // TODO: MIME validation (check against allowlist)
    // TODO: Virus scanning integration

    // Create payload record
    const { data: payload, error: payloadError } = await supabase
      .from('payloads')
      .insert({
        instance_id,
        tenant_id,
        class: fileClass,
        size_bytes,
        storage_tier: size_bytes > SOFT_CAP_BYTES ? 'central_object' : 'db_small',
        uri,
        status: 'active'
      })
      .select()
      .single()

    if (payloadError) {
      console.error('Error creating payload:', payloadError)
      throw new Error(`Failed to create payload: ${payloadError.message}`)
    }

    // If envelope data provided (client-side encryption), store it
    if (envelope && fileClass === 'sensitive') {
      const { subject_type, subject_id, key_ref, wrapped_dek, alg } = envelope
      
      const { error: envelopeError } = await supabase
        .from('envelopes')
        .insert({
          payload_id: payload.id,
          subject_type,
          subject_id,
          key_ref,
          wrapped_dek,
          alg: alg || 'AES-256-GCM',
          version: 1
        })

      if (envelopeError) {
        console.error('Error creating envelope:', envelopeError)
        // Don't fail the whole upload, but log warning
        console.warn('Envelope creation failed, payload created without encryption metadata')
      }
    }

    // Create media asset record if applicable
    if (mime_type?.startsWith('image/') || mime_type?.startsWith('video/')) {
      const { error: assetError } = await supabase
        .from('assets')
        .insert({
          tenant_id,
          site_id: body.site_id || null,
          payload_id: payload.id,
          storage_uri: uri,
          mime: mime_type
        })

      if (assetError) {
        console.error('Error creating media asset:', assetError)
      }
    }

    console.log('Upload intake successful', { payload_id: payload.id, size_bytes, warning })

    return new Response(
      JSON.stringify({ 
        success: true, 
        payload_id: payload.id,
        warning 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Upload intake error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
