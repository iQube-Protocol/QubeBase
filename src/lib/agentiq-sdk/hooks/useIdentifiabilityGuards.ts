import { useState } from 'react';
import { Identifiability } from '../types/smm';
import { 
  getCurrentPersona, 
  getIdentifiabilityPolicy, 
  canEscalate,
  auditIdentifiabilityChange 
} from '../adapters/didQube';

export interface IdentifiabilityGuardResult {
  allowed: boolean;
  requiresConfirm: boolean;
  message?: string;
}

export function useIdentifiabilityGuards() {
  const [isGuarding, setIsGuarding] = useState(false);

  const requireGuard = async (
    targetLevel: Identifiability,
    scope: string
  ): Promise<IdentifiabilityGuardResult> => {
    setIsGuarding(true);

    try {
      const persona = await getCurrentPersona();
      const policy = await getIdentifiabilityPolicy();

      const currentLevel = persona.identifiability;
      const levels: Identifiability[] = ['anon', 'pseudo', 'semi', 'full'];
      const currentIdx = levels.indexOf(currentLevel);
      const targetIdx = levels.indexOf(targetLevel);

      // Check if escalation is needed
      if (targetIdx <= currentIdx) {
        return { allowed: true, requiresConfirm: false };
      }

      // Check minimum level
      const minIdx = levels.indexOf(policy.min);
      if (targetIdx < minIdx) {
        return {
          allowed: false,
          requiresConfirm: false,
          message: `Minimum identifiability level is ${policy.min}`
        };
      }

      // Check if escalation is allowed
      const canEscalateResult = await canEscalate(scope);
      if (!canEscalateResult) {
        return {
          allowed: false,
          requiresConfirm: false,
          message: 'Identifiability escalation not allowed for this scope'
        };
      }

      // Return confirmation requirement
      return {
        allowed: true,
        requiresConfirm: policy.warnOnIncrease || policy.doubleConfirm,
        message: policy.warnOnIncrease
          ? `This action requires ${targetLevel} identifiability (currently ${currentLevel})`
          : undefined
      };
    } finally {
      setIsGuarding(false);
    }
  };

  const confirmEscalation = async (
    fromLevel: Identifiability,
    toLevel: Identifiability,
    scope: string
  ) => {
    // Log the escalation to audit trail
    await auditIdentifiabilityChange({
      fromLevel,
      toLevel,
      scope,
      userConfirmed: true
    });
  };

  return {
    requireGuard,
    confirmEscalation,
    isGuarding
  };
}
