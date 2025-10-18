import { IQuBeMeta, FilterExpression } from '../types/smm';

export interface RegistryQueryFilter {
  discoverable?: FilterExpression;
  operable?: FilterExpression;
  activatable?: FilterExpression;
  personaId: string;
  agent: string;
  tenantId: string;
  userRights: string[];
}

export async function queryRegistry(filter: RegistryQueryFilter): Promise<IQuBeMeta[]> {
  // TODO: Query iQube registry with merged filters
  // Server-side should merge: persona + orchestrator + tenant policy + user access rights
  
  // Placeholder: return empty array
  // In production, this would call:
  // POST /api/iqube/registry/query with filter body
  return [];
}

export async function getIQuBeMetadata(iqubeId: string): Promise<IQuBeMeta | null> {
  // TODO: Fetch single iQube metadata by ID
  return null;
}

export function evaluateFilterExpression(
  expr: FilterExpression,
  tags: string[]
): boolean {
  // Local filter evaluation helper
  if (expr.all && !expr.all.every(t => tags.includes(t))) return false;
  if (expr.any && !expr.any.some(t => tags.includes(t))) return false;
  if (expr.not && expr.not.some(t => tags.includes(t))) return false;
  return true;
}
