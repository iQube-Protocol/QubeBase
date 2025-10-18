export type AgentKey = 'nakamoto' | 'kn0w1' | 'moneypenny' | 'aigent-z' | string;
export type Role = 'user' | 'admin' | 'super_admin' | 'uber_admin';
export type Identifiability = 'anon' | 'pseudo' | 'semi' | 'full';

export interface FilterExpression {
  any?: string[];
  all?: string[];
  not?: string[];
}

export interface SmartMenuManifest {
  version: string;
  tenantId: string;
  appId: string;
  theme?: {
    mode?: 'light' | 'dark';
    translucency?: 'off' | 'low' | 'high';
    iconPack?: string;
  };
  entry: string;
  nodes: MenuNode[];
  agents: {
    active: AgentKey;
    origin?: AgentKey;
    allowed: AgentKey[];
  };
  persona: {
    defaultPersonaId?: string;
    identifiability: {
      min: Identifiability;
      warnOnIncrease: boolean;
      doubleConfirm: boolean;
    };
    historyScope: {
      includeAgents?: AgentKey[];
      excludeAgents?: AgentKey[];
      aggregateAcrossAgents?: boolean;
    };
  };
  iqube: {
    discoverable: FilterExpression;
    operable: FilterExpression;
    activatable: FilterExpression;
  };
  roles: Partial<Record<Role, { allowedNodes?: string[] }>>;
  features: {
    profile?: boolean;
    payments?: boolean;
    wallet?: boolean;
    crm?: boolean;
  };
  signatures?: {
    by: string;
    jws: string;
    issuedAt: string;
  };
}

export interface MenuNode {
  id: string;
  label: string;
  route?: string;
  children?: MenuNode[];
  gatedBy?: {
    roles?: Role[];
    feature?: keyof SmartMenuManifest['features'];
  };
}

export interface IQuBeMeta {
  id: string;
  tags: string[];
  ownerDid: string;
  capabilities: string[];
}

export interface PersonaData {
  id: string;
  identifiability: Identifiability;
  displayName?: string;
}
