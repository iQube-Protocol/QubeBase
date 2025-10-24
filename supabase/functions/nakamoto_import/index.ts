import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas for Nakamoto migration data
const UserMigrationRecordSchema = z.object({
  source_user_id: z.string().uuid(),
  email: z.string().email(),
  tenant_id: z.string().uuid().optional(),
  status: z.enum(['completed', 'invited', 'expired']),
  persona_type: z.enum(['knyt', 'qripto']),
  invitation_status: z.object({
    invited_at: z.string(),
    invited_by: z.string().nullable(),
    batch_id: z.string().nullable(),
    email_sent: z.boolean(),
    email_sent_at: z.string().nullable(),
    send_attempts: z.number(),
    expires_at: z.string(),
    signup_completed: z.boolean(),
    completed_at: z.string().nullable(),
    invitation_token: z.string(),
  }),
  persona_data: z.record(z.any()),
  connection_data: z.array(z.object({
    service: z.string(),
    connected_at: z.string(),
    connection_data: z.any(),
  })).optional().default([]),
  name_preferences: z.object({
    persona_type: z.string(),
    name_source: z.string(),
    invitation_first_name: z.string().nullable(),
    invitation_last_name: z.string().nullable(),
    linkedin_first_name: z.string().nullable().optional(),
    linkedin_last_name: z.string().nullable().optional(),
    custom_first_name: z.string().nullable().optional(),
    custom_last_name: z.string().nullable().optional(),
  }).nullable(),
  profile: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    total_points: z.number(),
    level: z.number(),
  }).nullable(),
  auth_user_id: z.string().uuid().nullable(),
  auth_created_at: z.string().nullable(),
  meta: z.record(z.any()).optional().default({}),
});

const InteractionHistorySchema = z.object({
  source_user_id: z.string().uuid(),
  query: z.string(),
  response: z.string(),
  interaction_type: z.string(),
  metadata: z.any().optional(),
  summarized: z.boolean().optional().default(false),
  created_at: z.string(),
  persona_type: z.enum(['knyt', 'qripto']).optional(),
});

const KBDocumentSchema = z.object({
  title: z.string(),
  content_text: z.string().optional(),
  source_uri: z.string().optional(),
  lang: z.string().optional().default('en'),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.any().optional().default({}),
});

const SystemPromptSchema = z.object({
  prompt_key: z.string(),
  prompt_text: z.string(),
  metadata: z.any().optional().default({}),
});

const ImportDataSchema = z.object({
  users: z.array(UserMigrationRecordSchema).optional().default([]),
  interactions: z.array(InteractionHistorySchema).optional().default([]),
  kb_documents: z.array(KBDocumentSchema).optional().default([]),
  system_prompt: SystemPromptSchema.optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Nakamoto Import Started ===');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    const body = await req.json();
    const providedTenantId = body?.tenant_id as string | undefined;
    const requestData = body?.data;

    // Resolve tenant ID
    let tenantId: string;
    if (providedTenantId) {
      const { data: isAdmin, error: adminCheckError } = await supabase
        .rpc('is_tenant_admin', { _user_id: user.id, _tenant_id: providedTenantId });
      
      if (adminCheckError || !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Not authorized for this tenant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      tenantId = providedTenantId;
    } else {
      const { data: detectedTenantId, error: tenantError } = await supabase
        .rpc('get_user_tenant', { _user_id: user.id });
      
      if (tenantError || !detectedTenantId) {
        return new Response(
          JSON.stringify({ error: 'Unable to resolve tenant. Please specify tenant_id.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      tenantId = detectedTenantId;
    }

    // Validate data
    const validatedData = ImportDataSchema.parse(requestData);

    const stats = {
      users: 0,
      interactions: 0,
      kb_documents: 0,
      system_prompt: false,
    };

    // Create or get Root corpus for KB documents
    let rootCorpusId: string | null = null;
    if (validatedData.kb_documents.length > 0) {
      const { data: existingCorpus } = await supabaseAdmin
        .from('corpora')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('app', 'nakamoto')
        .eq('name', 'Root')
        .eq('scope', 'root')
        .single();

      if (existingCorpus) {
        rootCorpusId = existingCorpus.id;
      } else {
        const { data: newCorpus, error: corpusError } = await supabaseAdmin
          .from('corpora')
          .insert({
            tenant_id: tenantId,
            app: 'nakamoto',
            name: 'Root',
            scope: 'root',
            description: 'Root knowledge base for Nakamoto platform',
          })
          .select('id')
          .single();

        if (corpusError) throw new Error(`Failed to create corpus: ${corpusError.message}`);
        rootCorpusId = newCorpus.id;
      }
    }

    // Import users
    const userIdMap = new Map<string, string>();
    for (const user of validatedData.users) {
      try {
        // Store migration record
        const { data: migrationRecord, error: migrationError } = await supabaseAdmin
          .from('user_migration_map')
          .insert({
            source_user_id: user.source_user_id,
            new_user_id: user.auth_user_id || user.source_user_id,
            email: user.email,
            tenant_id: user.tenant_id || tenantId,
            migration_metadata: {
              status: user.status,
              persona_type: user.persona_type,
              persona_data: user.persona_data,
              invitation_status: user.invitation_status,
              connection_data: user.connection_data,
              name_preferences: user.name_preferences,
              profile: user.profile,
              meta: user.meta,
            },
          })
          .select('source_user_id, new_user_id')
          .single();

        if (migrationError) {
          console.error(`Failed to import user ${user.email}:`, migrationError);
          continue;
        }

        userIdMap.set(migrationRecord.source_user_id, migrationRecord.new_user_id);
        stats.users++;
      } catch (err) {
        console.error(`Error importing user ${user.email}:`, err);
      }
    }

    // Import interactions
    for (const interaction of validatedData.interactions) {
      try {
        const newUserId = userIdMap.get(interaction.source_user_id) || interaction.source_user_id;
        
        await supabaseAdmin
          .from('interaction_history')
          .insert({
            app: 'nakamoto',
            tenant_id: tenantId,
            user_id: newUserId,
            query_text: interaction.query,
            response_text: interaction.response,
            interaction_type: interaction.interaction_type,
            persona_type: interaction.persona_type,
            summarized: interaction.summarized,
            source_metadata: interaction.metadata || {},
            occurred_at: interaction.created_at,
          });

        stats.interactions++;
      } catch (err) {
        console.error('Error importing interaction:', err);
      }
    }

    // Import KB documents
    if (rootCorpusId) {
      for (const doc of validatedData.kb_documents) {
        try {
          // Upsert by title (deduplicate)
          const { error: docError } = await supabaseAdmin
            .from('docs')
            .upsert({
              corpus_id: rootCorpusId,
              tenant_id: tenantId,
              title: doc.title,
              content_text: doc.content_text || '',
              tags: doc.tags,
              metadata: {
                ...doc.metadata,
                source_uri: doc.source_uri,
                lang: doc.lang,
              },
            }, {
              onConflict: 'corpus_id,title',
            });

          if (docError) {
            console.error(`Failed to import doc ${doc.title}:`, docError);
            continue;
          }

          stats.kb_documents++;
        } catch (err) {
          console.error(`Error importing doc ${doc.title}:`, err);
        }
      }
    }

    // Import system prompt
    if (validatedData.system_prompt) {
      try {
        await supabaseAdmin
          .from('prompts')
          .upsert({
            app: 'nakamoto',
            tenant_id: null,
            scope: 'root',
            prompt_key: validatedData.system_prompt.prompt_key,
            prompt_text: validatedData.system_prompt.prompt_text,
            metadata: validatedData.system_prompt.metadata,
          }, {
            onConflict: 'app,tenant_id,prompt_key,scope',
          });

        stats.system_prompt = true;
      } catch (err) {
        console.error('Error importing system prompt:', err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Nakamoto import completed',
        stats,
        tenant_id: tenantId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Import error:', error);

    let errorMessage = 'Import failed';
    let statusCode = 500;

    if (error instanceof z.ZodError) {
      errorMessage = 'Invalid data format';
      statusCode = 400;
      console.error('Validation errors:', error.errors);
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof z.ZodError ? error.errors : error.message,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
