import { useEffect, useState } from 'react';
import { SmartMenuManifest } from '../types/smm';
import { fetchCachedManifest } from '../adapters/qubeBase';
import { useAgentContext } from './useAgentContext';
import { usePersona } from './usePersona';

export function useSmartMenu(appId: string) {
  const [manifest, setManifest] = useState<SmartMenuManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const { activeAgent } = useAgentContext();
  const { persona } = usePersona();

  useEffect(() => {
    const loadManifest = async () => {
      setLoading(true);
      try {
        const cached = await fetchCachedManifest(appId);
        setManifest(cached);
      } catch (error) {
        console.error('Failed to load Smart Menu manifest:', error);
      } finally {
        setLoading(false);
      }
    };

    loadManifest();
  }, [appId, activeAgent, persona]);

  return {
    manifest,
    loading,
    reload: () => fetchCachedManifest(appId).then(setManifest)
  };
}
