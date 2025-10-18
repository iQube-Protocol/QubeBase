import { createMachine, assign } from 'xstate';
import { AgentKey } from '../types/smm';

export interface SmartMenuContext {
  agent: AgentKey;
  origin: AgentKey | null;
  persona: string;
  tenantId?: string;
}

export type SmartMenuEvent =
  | { type: 'SWITCH_AGENT'; agent: AgentKey }
  | { type: 'RETURN_TO_ORIGIN' }
  | { type: 'SWITCH_PERSONA'; persona: string }
  | { type: 'APPLY_FILTERS' };

export const smartMenuMachine = createMachine({
  id: 'smartMenu',
  initial: 'idle',
  context: {
    agent: 'kn0w1' as AgentKey,
    origin: null as AgentKey | null,
    persona: 'qripto',
    tenantId: undefined
  } as SmartMenuContext,
  states: {
    idle: {
      on: {
        SWITCH_AGENT: {
          actions: assign({
            origin: ({ context, event }) => 
              context.origin ?? context.agent,
            agent: ({ event }) => event.agent
          })
        },
        RETURN_TO_ORIGIN: {
          actions: assign({
            agent: ({ context }) => context.origin ?? context.agent,
            origin: () => null
          })
        },
        SWITCH_PERSONA: {
          actions: assign({
            persona: ({ event }) => event.persona
          })
        }
      }
    }
  }
});
