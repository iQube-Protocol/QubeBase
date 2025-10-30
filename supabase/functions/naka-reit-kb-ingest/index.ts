import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 REIT KB Ingest - Request received');

    // Validate authorization token
    const authHeader = req.headers.get('Authorization');
    const expectedToken = Deno.env.get('SYNC_SECRET_TOKEN');
    
    if (!expectedToken) {
      throw new Error('SYNC_SECRET_TOKEN not configured');
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== expectedToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse request body
    const { items, force_update = false } = await req.json();

    if (!items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request: items array required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📦 Processing ${items.length} items (force_update: ${force_update})`);

    // Initialize Supabase client with kb schema
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'kb' }
    });

    // Find the root corpus
    console.log('🔍 Looking up root corpus...');
    
    // First try to find by site_id
    let { data: corpus, error: corpusError } = await supabase
      .from('corpora')
      .select('id')
      .eq('site_id', 'root')
      .maybeSingle();

    // If not found by site_id, try by name
    if (!corpus) {
      console.log('Root corpus not found by site_id, trying by name...');
      const result = await supabase
        .from('corpora')
        .select('id')
        .eq('name', 'root')
        .maybeSingle();
      
      corpus = result.data;
      corpusError = result.error;
    }

    if (corpusError) {
      throw new Error(`Error finding root corpus: ${corpusError.message}`);
    }

    if (!corpus) {
      throw new Error('Root corpus not found. Please create a corpus with site_id="root" or name="root"');
    }

    const corpusId = corpus.id;
    console.log(`✅ Found root corpus: ${corpusId}`);

    // Process each item
    const results = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as any[]
    };

    for (const item of items) {
      try {
        const { title, content, metadata } = item;

        if (!title || !content) {
          results.errors.push({ item, error: 'Missing title or content' });
          continue;
        }

        // Check if document already exists
        const { data: existingDoc } = await supabase
          .from('docs')
          .select('id, doc_version')
          .eq('corpus_id', corpusId)
          .eq('title', title)
          .eq('scope', 'tenant')
          .eq('tenant_id', 'aigent-jmo')
          .maybeSingle();

        if (existingDoc && !force_update) {
          console.log(`⏭️ Skipping existing doc: ${title}`);
          results.skipped++;
          continue;
        }

        const docData = {
          corpus_id: corpusId,
          title,
          content,
          scope: 'tenant',
          tenant_id: 'aigent-jmo',
          metadata: metadata || {},
          doc_version: existingDoc ? existingDoc.doc_version + 1 : 1,
          updated_at: new Date().toISOString()
        };

        if (existingDoc) {
          // Update existing document
          const { error: updateError } = await supabase
            .from('docs')
            .update(docData)
            .eq('id', existingDoc.id);

          if (updateError) throw updateError;

          // Enqueue reindex
          await supabase
            .from('reindex_queue')
            .insert({
              doc_id: existingDoc.id,
              action: 'upsert',
              status: 'pending'
            });

          console.log(`✏️ Updated doc: ${title}`);
          results.updated++;
        } else {
          // Insert new document
          const { data: newDoc, error: insertError } = await supabase
            .from('docs')
            .insert({
              ...docData,
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          // Enqueue reindex
          await supabase
            .from('reindex_queue')
            .insert({
              doc_id: newDoc.id,
              action: 'upsert',
              status: 'pending'
            });

          console.log(`➕ Created doc: ${title}`);
          results.created++;
        }

      } catch (error: any) {
        console.error(`Error processing item "${item.title}":`, error);
        results.errors.push({ item, error: error.message });
      }
    }

    console.log('✅ Ingest complete:', results);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Ingest error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
