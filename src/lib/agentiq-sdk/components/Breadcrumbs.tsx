import React from 'react';
import { useAgentContext } from '../hooks/useAgentContext';

export function Breadcrumbs() {
  const { activeAgent, originAgent } = useAgentContext();

  const crumbs = originAgent 
    ? [originAgent, activeAgent]
    : [activeAgent];

  return (
    <nav className="flex items-center gap-2 text-sm">
      {crumbs.map((crumb, idx) => (
        <React.Fragment key={crumb}>
          {idx > 0 && <span className="text-muted-foreground">/</span>}
          <span className={idx === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground'}>
            {crumb}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
}
