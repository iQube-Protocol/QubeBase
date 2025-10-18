import { SmartMenuManifest, Role } from '../types/smm';

export async function fetchCachedManifest(appId: string): Promise<SmartMenuManifest | null> {
  // TODO: SELECT from menu_manifests WHERE app_id = appId
  // Uses RLS: menu_manifest_read policy
  return null;
}

export function current_did(): string {
  // TODO: Get from session or auth context
  return 'did:qb:123';
}

export async function hasRole(...roles: Role[]): Promise<boolean> {
  // TODO: Check user_roles table via security definer function
  // Example: SELECT has_role(current_did(), 'admin')
  return roles.includes('user');
}

export async function savePersonaHistory(args: {
  personaId: string;
  agent: string;
  event: object;
}) {
  // TODO: INSERT INTO persona_histories
  // Uses RLS: persona_histories_self policy
  console.log('Save persona history:', args);
}

export async function getPersonaHistory(args: {
  personaId?: string;
  agent?: string;
  limit?: number;
}): Promise<any[]> {
  // TODO: SELECT from persona_histories with filters
  // Uses RLS: persona_histories_self policy
  return [];
}
