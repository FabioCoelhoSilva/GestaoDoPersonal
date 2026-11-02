import { BillingStatus } from '@prisma/client';
import { scopedPrisma } from '../db/scoped-prisma';

export type BillingResource = 'students' | 'workouts';

export type BillingOverview = {
  subscription: {
    status: BillingStatus;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  plan: {
    name: string;
    maxStudents: number | null;
    maxWorkouts: number | null;
  } | null;
  usage: {
    activeStudents: number;
    activeWorkouts: number;
  };
  accessAllowed: boolean;
};

export class BillingAccessDeniedError extends Error {
  readonly code: 'SUBSCRIPTION_REQUIRED' | 'SUBSCRIPTION_INACTIVE' | 'PLAN_UNAVAILABLE';

  constructor(code: BillingAccessDeniedError['code'], message: string) {
    super(message);
    this.name = 'BillingAccessDeniedError';
    this.code = code;
  }
}

export class PlanLimitExceededError extends Error {
  constructor(
    readonly resource: BillingResource,
    readonly limit: number,
    readonly current: number,
  ) {
    super(`Limite do plano atingido para ${resource}`);
    this.name = 'PlanLimitExceededError';
  }
}

function requireTenantId(tenantId: string) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new Error('tenantId é obrigatório para consultar o billing');
  }
  return tenantId;
}

export async function getBillingOverview(tenantId: string): Promise<BillingOverview> {
  const tenant = requireTenantId(tenantId);
  const db = scopedPrisma(tenant);
  const [subscription, activeStudents, activeWorkouts] = await Promise.all([
    db.billingSubscription.findUnique({
      where: { personalId: tenant },
      select: {
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        plan: {
          select: {
            name: true,
            maxStudents: true,
            maxWorkouts: true,
            active: true,
          },
        },
      },
    }),
    db.student.count({ where: { active: true, anonymizedAt: null } }),
    db.workout.count({ where: { active: true } }),
  ]);

  const plan = subscription?.plan?.active
    ? {
        name: subscription.plan.name,
        maxStudents: subscription.plan.maxStudents,
        maxWorkouts: subscription.plan.maxWorkouts,
      }
    : null;
  const statusAllowsAccess =
    subscription?.status === BillingStatus.ACTIVE ||
    subscription?.status === BillingStatus.TRIALING;

  return {
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    plan,
    usage: { activeStudents, activeWorkouts },
    accessAllowed: Boolean(statusAllowsAccess && plan),
  };
}

function requireAccess(overview: BillingOverview) {
  if (!overview.subscription) {
    throw new BillingAccessDeniedError(
      'SUBSCRIPTION_REQUIRED',
      'O tenant não possui uma subscrição ativa',
    );
  }
  if (
    overview.subscription.status !== BillingStatus.ACTIVE &&
    overview.subscription.status !== BillingStatus.TRIALING
  ) {
    throw new BillingAccessDeniedError(
      'SUBSCRIPTION_INACTIVE',
      'A subscrição não permite acesso aos recursos do produto',
    );
  }
  if (!overview.plan) {
    throw new BillingAccessDeniedError(
      'PLAN_UNAVAILABLE',
      'O plano associado à subscrição não está disponível',
    );
  }
}

export async function assertSubscriptionAccess(tenantId: string) {
  const overview = await getBillingOverview(tenantId);
  requireAccess(overview);
  return overview;
}

export async function assertPlanCapacity(
  tenantId: string,
  resource: BillingResource,
) {
  const overview = await getBillingOverview(tenantId);
  requireAccess(overview);

  const limit = resource === 'students'
    ? overview.plan!.maxStudents
    : overview.plan!.maxWorkouts;
  const current = resource === 'students'
    ? overview.usage.activeStudents
    : overview.usage.activeWorkouts;

  if (limit !== null && current >= limit) {
    throw new PlanLimitExceededError(resource, limit, current);
  }
}
