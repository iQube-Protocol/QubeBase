// Components
export { SmartMenuShell } from '../components/SmartMenuShell';
export { AgentSwitcher } from '../components/AgentSwitcher';
export { PersonaSwitcher } from '../components/PersonaSwitcher';
export { IQuBePanel } from '../components/IQuBePanel';
export { Breadcrumbs } from '../components/Breadcrumbs';
export { ProfilePane } from '../components/ProfilePane';
export { WalletDock } from '../components/WalletDock';

// Hooks
export { useAgentContext } from '../hooks/useAgentContext';
export { usePersona } from '../hooks/usePersona';
export { useIQuBeFilters } from '../hooks/useIQuBeFilters';
export { useIdentifiabilityGuards } from '../hooks/useIdentifiabilityGuards';
export { useSmartMenu } from '../hooks/useSmartMenu';
export { useTheme } from '../hooks/useTheme';

// Types
export type {
  AgentKey,
  Role,
  Identifiability,
  FilterExpression,
  SmartMenuManifest,
  MenuNode,
  IQuBeMeta,
  PersonaData
} from '../types/smm';

// Adapters (re-export for advanced usage)
export * as DIDQubeAdapter from '../adapters/didQube';
export * as QubeBaseAdapter from '../adapters/qubeBase';
export * as IQuBeRegistryAdapter from '../adapters/iqubeRegistry';

// State Machine
export { smartMenuMachine } from '../machine/smartMenuMachine';
export type { SmartMenuContext, SmartMenuEvent } from '../machine/smartMenuMachine';

// Theme
export { theme } from '../theme';
export type { Theme } from '../theme';
