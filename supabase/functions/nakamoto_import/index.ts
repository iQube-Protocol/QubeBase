import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas for Nakamoto migration data

const InvitationStatusSchema = z.object({
  invited_at: z.string(),
  invited_by: z.string().nullable().optional(),
  batch_id: z.string().nullable().optional(),
  email_sent: z.boolean(),
  email_sent_at: z.string().nullable().optional(),
  send_attempts: z.number(),
  expires_at: z.string(),
  signup_completed: z.boolean(),
  completed_at: z.string().nullable().optional(),
  invitation_token: z.string(),
});

const ConnectionDataSchema = z.object({
  service: z.string(),
  connected_at: z.string(),
  connection_data: z.any().optional(),
});

const NamePreferencesSchema = z.object({
  persona_type: z.string(),
  name_source: z.string(),
  invitation_first_name: z.string().nullable().optional(),
  invitation_last_name: z.string().nullable().optional(),
  linkedin_first_name: z.string().nullable().optional(),
  linkedin_last_name: z.string().nullable().optional(),
  custom_first_name: z.string().nullable().optional(),
  custom_last_name: z.string().nullable().optional(),
});

const ProfileSchema = z.object({
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  total_points: z.number(),
  level: z.number(),
});

const UserMigrationRecordSchema = z.object({
  source_user_id: z.string(),
  email: z.string().email(),
  tenant_id: z.string().uuid(),
  status: z.enum(['completed', 'invited', 'expired']),
  persona_type: z.enum(['knyt', 'qripto']),
  invitation_status: InvitationStatusSchema,
  persona_data: z.record(z.any()),
  connection_data: z.array(ConnectionDataSchema).optional().default([]),
  name_preferences: NamePreferencesSchema.nullable().optional(),
  profile: ProfileSchema.nullable().optional(),
  auth_user_id: z.string().uuid().nullable().optional(),
  auth_created_at: z.string().nullable().optional(),
  meta: z.record(z.any()).optional().default({}),
});

const InteractionHistorySchema = z.object({
  source_user_id: z.string(),
  query: z.string(),
  response: z.string(),
  interaction_type: z.string(),
  metadata: z.any().optional(),
  summarized: z.boolean(),
  created_at: z.string(),
  persona_type: z.enum(['knyt', 'qripto']).optional(),
});

const KBDocumentSchema = z.object({
  title: z.string(),
  content_text: z.string().optional().default(''),
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
  knowledge_base: z.array(KBDocumentSchema).optional().default([]),
  prompts: z.array(SystemPromptSchema).optional().default([]),
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Nakamoto Import Started ===');
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
    console.log('Checking authentication...');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('User authenticated:', user.id);

    // Parse request body
    console.log('Parsing request body...');
    const body = await req.json().catch((e) => {
      console.error('JSON parse error:', e);
      return {} as any;
    });
    
    const providedTenantId = (body as any)?.tenant_id as string | undefined;
    const requestData = (body as any)?.data;
    console.log('Provided tenant ID:', providedTenantId || 'auto-detect');

    // Resolve tenant ID
    let tenantId: string | null = null;

    if (providedTenantId) {
      // Verify admin status
      console.log('Checking admin status for tenant:', providedTenantId);
      const { data: isAdmin, error: adminCheckError } = await supabase
        .rpc('is_tenant_admin', { _user_id: user.id, _tenant_id: providedTenantId });

      if (adminCheckError) {
        console.error('is_tenant_admin RPC error:', adminCheckError);
        return new Response(
          JSON.stringify({ error: 'Authorization check failed', details: adminCheckError.message }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isAdmin) {
        console.warn('User is not admin of tenant:', providedTenantId);
        return new Response(
          JSON.stringify({ error: 'You are not an admin of the selected tenant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tenantId = providedTenantId;
      console.log('Admin verified, using tenant:', tenantId);
    } else {
      // Auto-detect tenant
      console.log('Auto-detecting tenant for user...');
      const { data: detectedTenantId, error: tenantError } = await supabase
        .rpc('get_user_tenant', { _user_id: user.id });

      if (tenantError || !detectedTenantId) {
        console.error('Tenant auto-detection failed:', tenantError);
        return new Response(
          JSON.stringify({ 
            error: 'Unable to resolve tenant automatically. Please specify tenant_id in the form.', 
            details: tenantError?.message 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tenantId = detectedTenantId;
      console.log('Auto-detected tenant:', tenantId);
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Invalid tenant configuration' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request data
    const validatedData = ImportDataSchema.parse(requestData);

    console.log('Import request:', {
      user: user.id,
      tenant: tenantId,
      counts: {
        users: validatedData.users.length,
        interactions: validatedData.interactions.length,
        knowledge_base: validatedData.knowledge_base.length,
        prompts: validatedData.prompts.length,
      },
    });

    const stats = {
      users: 0,
      interactions: 0,
      knowledge_base: 0,
      prompts: 0,
    };

    // Track user ID mappings
    const userIdMap = new Map<string, string>();

    // Import users
    for (const userRecord of validatedData.users) {
      try {
        // Build migration metadata
        const migrationMetadata = {
          status: userRecord.status,
          persona_type: userRecord.persona_type,
          invitation_status: userRecord.invitation_status,
          persona_data: userRecord.persona_data,
          connection_data: userRecord.connection_data,
          name_preferences: userRecord.name_preferences,
          profile: userRecord.profile,
          auth_user_id: userRecord.auth_user_id,
          auth_created_at: userRecord.auth_created_at,
          meta: userRecord.meta,
        };

        // Insert into user_migration_map
        const { data: inserted, error } = await supabase
          .from('app_nakamoto.user_migration_map')
          .insert({
            source_user_id: userRecord.source_user_id,
            new_user_id: userRecord.auth_user_id || userRecord.source_user_id,
            email: userRecord.email,
            tenant_id: userRecord.tenant_id,
            migration_metadata: migrationMetadata,
          })
          .select('source_user_id, new_user_id')
          .single();

        if (error) {
          console.error('User migration insert error:', error);
          // Skip on duplicate
          if (!error.message?.includes('duplicate')) {
            throw new Error(`Failed to insert user migration: ${userRecord.email}`);
          }
        } else if (inserted) {
          userIdMap.set(inserted.source_user_id, inserted.new_user_id);
          stats.users++;
          console.log('Imported user:', userRecord.email);
        }
      } catch (err) {
        console.error('Error importing user:', userRecord.email, err);
      }
    }

    // Import interaction histories
    for (const interaction of validatedData.interactions) {
      try {
        const newUserId = userIdMap.get(interaction.source_user_id);
        if (!newUserId) {
          console.warn(`User ID not found for interaction: ${interaction.source_user_id}`);
          continue;
        }

        const { error } = await supabase
          .from('app_nakamoto.interaction_history')
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

        if (error) {
          console.error('Interaction insert error:', error);
        } else {
          stats.interactions++;
        }
      } catch (err) {
        console.error('Error importing interaction:', err);
      }
    }

    // Import knowledge base documents
    if (validatedData.knowledge_base.length > 0) {
      // Get or create root corpus for nakamoto
      let corpusId: string | null = null;
      
      const { data: existingCorpus, error: corpusSelectError } = await supabase
        .from('kb.corpora')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('app', 'nakamoto')
        .eq('scope', 'root')
        .eq('name', 'Root')
        .single();

      if (existingCorpus) {
        corpusId = existingCorpus.id;
        console.log('Using existing corpus:', corpusId);
      } else {
        const { data: newCorpus, error: corpusInsertError } = await supabase
          .from('kb.corpora')
          .insert({
            tenant_id: tenantId,
            app: 'nakamoto',
            name: 'Root',
            scope: 'root',
            description: 'Nakamoto knowledge base root corpus',
          })
          .select('id')
          .single();

        if (corpusInsertError) {
          console.error('Corpus insert error:', corpusInsertError);
        } else if (newCorpus) {
          corpusId = newCorpus.id;
          console.log('Created new corpus:', corpusId);
        }
      }

      if (corpusId) {
        for (const doc of validatedData.knowledge_base) {
          try {
            const { error } = await supabase
              .from('kb.docs')
              .upsert({
                corpus_id: corpusId,
                tenant_id: tenantId,
                title: doc.title,
                content_text: doc.content_text,
                content_type: 'text/markdown',
                tags: doc.tags,
                metadata: {
                  ...doc.metadata,
                  source_uri: doc.source_uri,
                  lang: doc.lang,
                },
              }, {
                onConflict: 'corpus_id,title',
              });

            if (error) {
              console.error('KB doc insert error:', error);
            } else {
              stats.knowledge_base++;
            }
          } catch (err) {
            console.error('Error importing KB doc:', doc.title, err);
          }
        }
      }
    }

    // Import prompts
    for (const prompt of validatedData.prompts) {
      try {
        const { error } = await supabase
          .from('prompts.prompts')
          .upsert({
            app: 'nakamoto',
            tenant_id: null, // Root prompt
            scope: 'root',
            prompt_key: prompt.prompt_key,
            prompt_text: prompt.prompt_text,
            status: 'active',
            metadata: prompt.metadata,
          }, {
            onConflict: 'app,tenant_id,prompt_key,scope',
          });

        if (error) {
          console.error('Prompt insert error:', error);
        } else {
          stats.prompts++;
        }
      } catch (err) {
        console.error('Error importing prompt:', prompt.prompt_key, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Nakamoto import completed successfully',
        stats,
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
        details: error instanceof z.ZodError ? error.errors : undefined,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});