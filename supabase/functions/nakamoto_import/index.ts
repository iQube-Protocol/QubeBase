import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas
const TemplateSchema = z.object({
  name: z.string().min(1).max(255),
  meta_public: z.record(z.any()).optional().default({}),
});

const InstanceSchema = z.object({
  template_name: z.string().min(1),
  meta_public: z.record(z.any()).optional().default({}),
  blak_pointer: z.string().max(500).optional(),
  tokenqube_key_id: z.string().max(255).optional(),
});

const ProofSchema = z.object({
  instance_ref: z.number().int().min(0),
  txid: z.string().min(1).max(500),
  chain: z.string().min(1).max(100),
  block_height: z.number().int().positive().optional(),
  proof_type: z.string().min(1).max(100),
  signature: z.string().max(1000).optional(),
});

const EntitlementSchema = z.object({
  instance_ref: z.number().int().min(0),
  expires_at: z.string().datetime().optional(),
  meta: z.record(z.any()).optional().default({}),
});

const ImportDataSchema = z.object({
  templates: z.array(TemplateSchema).optional().default([]),
  instances: z.array(InstanceSchema).optional().default([]),
  proofs: z.array(ProofSchema).optional().default([]),
  entitlements: z.array(EntitlementSchema).optional().default([]),
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

    // Parse body early to allow optional tenant override
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
      // Verify the user is an admin of the provided tenant via RPC
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
      // Fallback: try to discover a tenant without joining roles to avoid policy recursion
      console.log('Auto-detecting tenant for user...');
      const { data: ur, error: urError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (urError || !ur) {
        console.error('User roles query failed:', urError);
        return new Response(
          JSON.stringify({ error: 'User tenant not found. Provide tenant_id in request body.', details: urError?.message }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Found user role, fetching tenant...');
      const { data: roleRow, error: roleErr } = await supabase
        .from('roles')
        .select('tenant_id')
        .eq('id', (ur as any).role_id)
        .limit(1)
        .maybeSingle();

      if (roleErr || !roleRow?.tenant_id) {
        console.error('Roles query failed:', roleErr);
        return new Response(
          JSON.stringify({ error: 'Unable to resolve tenant automatically. Please specify tenant_id.', details: roleErr?.message }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tenantId = (roleRow as any).tenant_id as string;
      console.log('Auto-detected tenant:', tenantId);
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Invalid tenant configuration' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const validatedData = ImportDataSchema.parse(requestData);

    console.log('Import request:', {
      user: user.id,
      tenant: tenantId,
      counts: {
        templates: validatedData.templates.length,
        instances: validatedData.instances.length,
        proofs: validatedData.proofs.length,
        entitlements: validatedData.entitlements.length,
      },
    });

    // Track imported IDs for references
    const templateMap = new Map<string, string>();
    const instanceIds: string[] = [];
    const stats = {
      templates: 0,
      instances: 0,
      proofs: 0,
      entitlements: 0,
    };

    // Import templates
    for (const template of validatedData.templates) {
      const { data: inserted, error } = await supabase
        .from('templates')
        .insert({
          name: template.name,
          meta_public: template.meta_public,
        })
        .select('id, name')
        .single();

      if (error) {
        console.error('Template insert error:', error);
        throw new Error(`Failed to insert template: ${template.name}`);
      }

      if (inserted) {
        templateMap.set(inserted.name, inserted.id);
        stats.templates++;
        console.log('Imported template:', inserted.name);
      }
    }

    // Import instances
    for (const instance of validatedData.instances) {
      const templateId = templateMap.get(instance.template_name);
      if (!templateId) {
        console.warn(`Template not found: ${instance.template_name}, skipping instance`);
        continue;
      }

      const { data: inserted, error } = await supabase
        .from('instances')
        .insert({
          template_id: templateId,
          owner_tenant_id: tenantId,
          meta_public: instance.meta_public,
          blak_pointer: instance.blak_pointer,
          tokenqube_key_id: instance.tokenqube_key_id,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Instance insert error:', error);
        throw new Error(`Failed to insert instance for template: ${instance.template_name}`);
      }

      if (inserted) {
        instanceIds.push(inserted.id);
        stats.instances++;
        console.log('Imported instance:', inserted.id);
      }
    }

    // Import proofs
    for (const proof of validatedData.proofs) {
      if (proof.instance_ref >= instanceIds.length) {
        console.warn(`Invalid instance_ref: ${proof.instance_ref}, skipping proof`);
        continue;
      }

      const instanceId = instanceIds[proof.instance_ref];

      const { error } = await supabase
        .from('proofs')
        .insert({
          instance_id: instanceId,
          txid: proof.txid,
          chain: proof.chain,
          block_height: proof.block_height,
          proof_type: proof.proof_type,
          signature: proof.signature,
        });

      if (error) {
        console.error('Proof insert error:', error);
        throw new Error(`Failed to insert proof for instance: ${instanceId}`);
      }

      stats.proofs++;
      console.log('Imported proof for instance:', instanceId);
    }

    // Import entitlements
    for (const entitlement of validatedData.entitlements) {
      if (entitlement.instance_ref >= instanceIds.length) {
        console.warn(`Invalid instance_ref: ${entitlement.instance_ref}, skipping entitlement`);
        continue;
      }

      const instanceId = instanceIds[entitlement.instance_ref];

      const { error } = await supabase
        .from('entitlements')
        .insert({
          instance_id: instanceId,
          tenant_id: tenantId,
          expires_at: entitlement.expires_at,
          meta: entitlement.meta,
        });

      if (error) {
        console.error('Entitlement insert error:', error);
        throw new Error(`Failed to insert entitlement for instance: ${instanceId}`);
      }

      stats.entitlements++;
      console.log('Imported entitlement for instance:', instanceId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Import completed successfully',
        stats,
        imported_instances: instanceIds,
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
