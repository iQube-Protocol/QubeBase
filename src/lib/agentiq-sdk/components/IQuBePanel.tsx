import React, { useEffect, useState } from 'react';
import { useIQuBeFilters } from '../hooks/useIQuBeFilters';
import { queryRegistry } from '../adapters/iqubeRegistry';
import { IQuBeMeta } from '../types/smm';

export interface IQuBePanelProps {
  mode: 'discover' | 'operate' | 'activate';
}

export function IQuBePanel({ mode }: IQuBePanelProps) {
  const { filters } = useIQuBeFilters();
  const [iqubes, setIqubes] = useState<IQuBeMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIQubes = async () => {
      setLoading(true);
      try {
        const results = await queryRegistry({
          [mode === 'discover' ? 'discoverable' : mode === 'operate' ? 'operable' : 'activatable']: 
            filters[mode === 'discover' ? 'discoverable' : mode === 'operate' ? 'operable' : 'activatable'],
          personaId: filters.persona,
          agent: filters.agent,
          tenantId: filters.tenantId || '',
          userRights: filters.userRights
        });
        setIqubes(results);
      } catch (error) {
        console.error('Failed to load iQubes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadIQubes();
  }, [filters, mode]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold mb-3 capitalize">{mode} iQubes</h3>
      
      <div className="text-xs text-muted-foreground mb-3">
        Persona: {filters.persona} • Agent: {filters.agent}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : iqubes.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No {mode} iQubes available
        </div>
      ) : (
        <div className="space-y-2">
          {iqubes.map((iqube) => (
            <div
              key={iqube.id}
              className="p-3 rounded-md bg-accent/50 hover:bg-accent cursor-pointer"
            >
              <div className="font-medium text-sm">{iqube.id}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {iqube.tags.join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
