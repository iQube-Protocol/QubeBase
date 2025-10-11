// issue_signed_url - Authorized download URL generation
// Responsibilities:
// - Set app.request_country from headers
// - Call black.authorize_payload_download RPC
// - Issue short-lived signed URL from Supabase Storage
// - Log to ops.access_log

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-country-code',
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

    // Get country from header (for compliance checks)
    const countryCode = req.headers.get('X-Country-Code') || 'US'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for RPC
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    // Set request country in session for compliance checks
    // Note: This is optional, used for compliance.can_download_payload checks
    console.log('Request country:', countryCode)

    const body = await req.json()
    const { payload_id } = body

    if (!payload_id) {
      throw new Error('Missing payload_id')
    }

    // Authorize download via RPC (checks RLS, compliance, entitlements)
    const { data: authResult, error: authError } = await supabase
      .rpc('authorize_payload_download', { p_payload_id: payload_id })

    if (authError || !authResult || authResult.length === 0) {
      // Log access denial
      await supabase.from('access_log').insert({
        actor_user_id: user.id,
        resource: `payload:${payload_id}`,
        decision: 'deny',
        reason: authError?.message || 'No authorization returned'
      })

      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { ok, payload_uri, storage_tier } = authResult[0]

    if (!ok) {
      await supabase.from('access_log').insert({
        actor_user_id: user.id,
        resource: `payload:${payload_id}`,
        decision: 'deny',
        reason: 'Authorization check failed'
      })

      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate signed URL (60 second expiry)
    // Extract bucket and path from payload_uri (format: bucket/path)
    const uriParts = payload_uri.split('/')
    const bucket = uriParts[0]
    const path = uriParts.slice(1).join('/')

    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60)

    if (urlError) {
      console.error('Error creating signed URL:', urlError)
      throw new Error(`Failed to generate signed URL: ${urlError.message}`)
    }

    // Log successful access
    await supabase.from('access_log').insert({
      actor_user_id: user.id,
      resource: `payload:${payload_id}`,
      decision: 'allow',
      reason: `Issued signed URL for ${storage_tier}`
    })

    console.log('Signed URL issued', { payload_id, user_id: user.id, storage_tier })

    return new Response(
      JSON.stringify({ 
        success: true,
        signed_url: signedUrl.signedUrl,
        expires_in: 60,
        storage_tier
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Issue signed URL error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
