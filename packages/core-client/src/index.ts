import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AgentiqInitOptions {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface AgentiqCoreClient {
  supabase: SupabaseClient;
  ensureIamUser(): Promise<{ ok: boolean }>;
}

export function initAgentiqClient(opts: AgentiqInitOptions = {}): AgentiqCoreClient {
  const supabaseUrl = opts.supabaseUrl || (typeof window !== 'undefined' ? (window as any).VITE_SUPABASE_URL : process.env.VITE_SUPABASE_URL);
  const supabaseKey = opts.supabaseAnonKey || (typeof window !== 'undefined' ? (window as any).VITE_SUPABASE_ANON_KEY : process.env.VITE_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase URL or anon key. Provide via init options or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.');
  }
  const supabase = createClient(supabaseUrl as string, supabaseKey as string);

  return {
    supabase,
    async ensureIamUser() {
      // Placeholder idempotent mirror: auth.user -> iam.users
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { ok: false };
      try {
        await supabase.rpc('iam_ensure_user', { p_uid: uid });
      } catch (_) {
        // ignore errors; function may not exist in some environments
      }
      return { ok: true };
    },
  };
}
