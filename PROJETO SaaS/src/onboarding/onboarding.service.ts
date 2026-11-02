import {
  PersonalProvisioningConflictError,
  PersonalProvisioningPlanUnavailableError,
  provisionPersonalTenant,
} from '../db/scoped-prisma';

export class OnboardingConfigurationError extends Error {
  constructor() {
    super('A avaliação inicial não está configurada');
    this.name = 'OnboardingConfigurationError';
  }
}

function getTrialConfiguration() {
  const planId = process.env.ONBOARDING_TRIAL_PLAN_ID?.trim();
  const trialDaysValue = process.env.ONBOARDING_TRIAL_DAYS ?? '14';
  const trialDays = Number(trialDaysValue);

  if (!planId || !/^\d+$/.test(trialDaysValue) || !Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90) {
    throw new OnboardingConfigurationError();
  }
  return { planId, trialDays };
}

export class OnboardingService {
  async provision(input: { providerSub: string; email: string }) {
    if (!input.providerSub || input.providerSub.trim().length === 0) {
      throw new Error('providerSub autenticado é obrigatório');
    }
    const email = input.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email autenticado inválido');
    }

    const configuration = getTrialConfiguration();
    return provisionPersonalTenant({
      providerSub: input.providerSub,
      email,
      trialPlanId: configuration.planId,
      trialDays: configuration.trialDays,
    });
  }
}
