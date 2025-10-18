import { atom, useAtom } from 'jotai';
import { AgentKey } from '../types/smm';

interface AgentState {
  active: AgentKey;
  origin: AgentKey | null;
}

const agentAtom = atom<AgentState>({
  active: 'kn0w1',
  origin: null
});

export function useAgentContext() {
  const [state, setState] = useAtom(agentAtom);

  const switchAgent = (agent: AgentKey) => {
    setState(prev => ({
      active: agent,
      origin: prev.origin ?? prev.active
    }));
  };

  const returnToOrigin = () => {
    if (state.origin) {
      setState({
        active: state.origin,
        origin: null
      });
    }
  };

  return {
    activeAgent: state.active,
    originAgent: state.origin,
    switchAgent,
    returnToOrigin
  };
}
