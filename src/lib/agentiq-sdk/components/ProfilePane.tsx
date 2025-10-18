import React, { useState } from 'react';
import { usePersona } from '../hooks/usePersona';

export function ProfilePane() {
  const [isOpen, setIsOpen] = useState(false);
  const { personaData } = usePersona();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-accent"
        aria-label="Profile"
      >
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
          {personaData?.displayName?.[0] || 'U'}
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 rounded-md border bg-card shadow-lg z-50">
          <div className="p-4">
            <div className="font-semibold">{personaData?.displayName || 'User'}</div>
            <div className="text-sm text-muted-foreground mt-1">
              ID: {personaData?.id || 'loading'}
            </div>
            <div className="text-sm text-muted-foreground">
              Identifiability: {personaData?.identifiability || 'loading'}
            </div>

            <div className="mt-4 pt-4 border-t space-y-2">
              <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent">
                Settings
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent">
                Privacy
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent text-destructive">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
