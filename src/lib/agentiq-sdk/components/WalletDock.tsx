import React, { useState } from 'react';

export function WalletDock() {
  const [isOpen, setIsOpen] = useState(false);
  
  // TODO: Integrate with actual wallet service
  const balance = '0.00 FIO';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-md border bg-background text-sm flex items-center gap-2"
      >
        <span className="font-mono">{balance}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-80 rounded-md border bg-card shadow-lg z-50">
          <div className="p-4">
            <h3 className="font-semibold mb-3">Wallet</h3>
            
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-accent/50">
                <div className="text-sm text-muted-foreground">Balance</div>
                <div className="text-2xl font-bold mt-1">{balance}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90">
                  Deposit
                </button>
                <button className="px-3 py-2 rounded-md border text-sm hover:bg-accent">
                  Withdraw
                </button>
              </div>

              <div className="pt-3 border-t">
                <div className="text-sm font-medium mb-2">Recent Transactions</div>
                <div className="text-sm text-muted-foreground">
                  No transactions yet
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
