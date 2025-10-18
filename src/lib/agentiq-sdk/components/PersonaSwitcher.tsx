import React, { useState } from 'react';
import { usePersona } from '../hooks/usePersona';

export function PersonaSwitcher() {
  const { persona, personaData, switchPersona } = usePersona();
  const [isOpen, setIsOpen] = useState(false);

  // TODO: Fetch available personas from DIDQube
  const availablePersonas = [
    { id: 'qripto', name: 'Qripto User', identifiability: 'semi' },
    { id: 'anon', name: 'Anonymous', identifiability: 'anon' },
    { id: 'verified', name: 'Verified User', identifiability: 'full' }
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-md border bg-background text-sm flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-primary" />
        {personaData?.displayName || persona}
        <span className="text-xs text-muted-foreground">
          ({personaData?.identifiability || 'loading'})
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-md border bg-card shadow-lg z-50">
          <div className="p-2 space-y-1">
            {availablePersonas.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  switchPersona(p.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent ${
                  p.id === persona ? 'bg-accent' : ''
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  Identifiability: {p.identifiability}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
