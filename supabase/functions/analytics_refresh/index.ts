// analytics_refresh - Materialized view refresh
// Responsibilities:
// - Refresh ops.mv_active_users_d and other MVs
// - Can be called via cron or on-demand

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MATERIALIZED_VIEWS = [
  'ops.mv_active_users_d',
  // Add more MVs here as they're created
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Use service role key for MV refresh (requires elevated permissions)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    const { views } = body // Optional: specify which views to refresh

    const viewsToRefresh = views || MATERIALIZED_VIEWS
    const results = []

    console.log('Starting analytics refresh', { views: viewsToRefresh })

    for (const view of viewsToRefresh) {
      try {
        const startTime = Date.now()
        
        // Execute REFRESH MATERIALIZED VIEW
        const { error } = await supabase.rpc('refresh_mv', { view_name: view })
        
        const duration = Date.now() - startTime

        if (error) {
          console.error(`Failed to refresh ${view}:`, error)
          results.push({ 
            view, 
            success: false, 
            error: error.message,
            duration_ms: duration
          })
        } else {
          console.log(`Refreshed ${view} in ${duration}ms`)
          results.push({ 
            view, 
            success: true,
            duration_ms: duration
          })
        }
      } catch (err) {
        console.error(`Exception refreshing ${view}:`, err)
        results.push({ 
          view, 
          success: false, 
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    console.log('Analytics refresh complete', { 
      total: results.length,
      success: successCount,
      failed: failCount
    })

    return new Response(
      JSON.stringify({ 
        success: failCount === 0,
        summary: { total: results.length, success: successCount, failed: failCount },
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Analytics refresh error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper RPC function to refresh MVs - add this to your migration:
/*
create or replace function public.refresh_mv(view_name text)
returns void
language plpgsql
security definer
as $$
begin
  execute format('refresh materialized view %I', view_name);
end;
$$;
*/
