import React from 'react';
import { useAgentContext } from '../hooks/useAgentContext';
import { AgentKey } from '../types/smm';

const AGENT_LABELS: Record<string, string> = {
  nakamoto: 'Nakamoto',
  'kn0w1': 'Kn0w1',
  moneypenny: 'MoneyPenny',
  'aigent-z': 'Aigent Z'
};

export function AgentSwitcher() {
  const { activeAgent, switchAgent, returnToOrigin, originAgent } = useAgentContext();

  const agents: AgentKey[] = ['nakamoto', 'kn0w1', 'moneypenny', 'aigent-z'];

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeAgent}
        onChange={(e) => switchAgent(e.target.value as AgentKey)}
        className="px-3 py-1.5 rounded-md border bg-background text-sm"
      >
        {agents.map((agent) => (
          <option key={agent} value={agent}>
            {AGENT_LABELS[agent] || agent}
          </option>
        ))}
      </select>
      
      {originAgent && (
        <button
          onClick={returnToOrigin}
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
        >
          Return to {AGENT_LABELS[originAgent] || originAgent}
        </button>
      )}
    </div>
  );
}
