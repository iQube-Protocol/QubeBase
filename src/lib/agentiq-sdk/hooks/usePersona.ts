import { useEffect, useState } from 'react';
import { atom, useAtom } from 'jotai';
import type { PersonaData } from '../types/smm';
import { getCurrentPersona } from '../adapters/didQube';
import { savePersonaHistory } from '../adapters/qubeBase';
import { useAgentContext } from './useAgentContext';

const personaAtom = atom<string>('qripto');

export function usePersona() {
  const [persona, setPersonaId] = useAtom(personaAtom);
  const [personaData, setPersonaData] = useState<PersonaData | null>(null);
  const { activeAgent } = useAgentContext();

  useEffect(() => {
    // Load current persona on mount
    getCurrentPersona().then((data) => {
      setPersonaData(data);
    }).catch((err) => {
      console.error('Failed to load persona:', err);
    });
  }, []);

  const switchPersona = async (newPersonaId: string) => {
    // Save history before switching
    await savePersonaHistory({
      personaId: persona,
      agent: activeAgent,
      event: { type: 'switch', to: newPersonaId }
    });

    setPersonaId(newPersonaId);
    
    // Reload persona data
    try {
      const data = await getCurrentPersona();
      setPersonaData(data);
    } catch (err) {
      console.error('Failed to load persona data:', err);
    }
  };

  return {
    persona,
    personaData,
    switchPersona
  };
}
