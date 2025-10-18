import React from 'react';
import { AgentSwitcher } from './AgentSwitcher';
import { PersonaSwitcher } from './PersonaSwitcher';
import { IQuBePanel } from './IQuBePanel';
import { ProfilePane } from './ProfilePane';
import { WalletDock } from './WalletDock';
import { Breadcrumbs } from './Breadcrumbs';

export interface SmartMenuShellProps {
  appId: string;
  enableProfile?: boolean;
  enableWallet?: boolean;
  enablePayments?: boolean;
  children?: React.ReactNode;
}

export function SmartMenuShell({
  appId,
  enableProfile = false,
  enableWallet = false,
  enablePayments = false,
  children
}: SmartMenuShellProps) {
  return (
    <div className="qb-shell min-h-screen bg-background">
      <div className="qb-topbar border-b bg-card">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            <AgentSwitcher />
            <PersonaSwitcher />
          </div>
          <div className="flex items-center gap-4">
            {enableProfile && <ProfilePane />}
            {enableWallet && <WalletDock />}
          </div>
        </div>
      </div>

      <div className="qb-breadcrumbs border-b bg-muted/30">
        <div className="container py-2">
          <Breadcrumbs />
        </div>
      </div>

      <div className="qb-body container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <IQuBePanel mode="discover" />
          </aside>
          <main className="lg:col-span-3">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
