import { BillingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { scopedPrisma, subscriptionFindUnique, studentCount, workoutCount } = vi.hoisted(() => ({
  scopedPrisma: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  studentCount: vi.fn(),
  workoutCount: vi.fn(),
}));

vi.mock('../src/db/scoped-prisma', () => ({ scopedPrisma }));

import {
  assertPlanCapacity,
  assertSubscriptionAccess,
  BillingAccessDeniedError,
  getBillingOverview,
  PlanLimitExceededError,
} from '../src/billing/subscription.service';

const subscription = {
  status: BillingStatus.ACTIVE,
  currentPeriodEnd: new Date('2027-01-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
  plan: {
    name: 'Teste',
    maxStudents: 2,
    maxWorkouts: 3,
    active: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionFindUnique.mockResolvedValue(subscription);
  studentCount.mockResolvedValue(1);
  workoutCount.mockResolvedValue(1);
  scopedPrisma.mockReturnValue({
    billingSubscription: { findUnique: subscriptionFindUnique },
    student: { count: studentCount },
    workout: { count: workoutCount },
  });
});

describe('billing subscription service', () => {
  it('reads subscription and usage through the authenticated tenant scope', async () => {
    await expect(getBillingOverview('tenant-1')).resolves.toEqual({
      subscription: {
        status: BillingStatus.ACTIVE,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      plan: { name: 'Teste', maxStudents: 2, maxWorkouts: 3 },
      usage: { activeStudents: 1, activeWorkouts: 1 },
      accessAllowed: true,
    });
    expect(scopedPrisma).toHaveBeenCalledWith('tenant-1');
    expect(subscriptionFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { personalId: 'tenant-1' },
    }));
    expect(studentCount).toHaveBeenCalledWith({
      where: { active: true, anonymizedAt: null },
    });
    expect(workoutCount).toHaveBeenCalledWith({ where: { active: true } });
  });

  it.each([BillingStatus.PAST_DUE, BillingStatus.CANCELED, BillingStatus.UNPAID])(
    'denies protected resources for subscription state %s',
    async (status) => {
      subscriptionFindUnique.mockResolvedValueOnce({ ...subscription, status });
      await expect(assertSubscriptionAccess('tenant-1')).rejects.toMatchObject({
        code: 'SUBSCRIPTION_INACTIVE',
      });
    },
  );

  it('allows a trial subscription with an active mapped plan', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({
      ...subscription,
      status: BillingStatus.TRIALING,
    });
    await expect(assertSubscriptionAccess('tenant-1')).resolves.toMatchObject({
      subscription: { status: BillingStatus.TRIALING },
      accessAllowed: true,
    });
  });

  it('denies a trial whose period has ended or has no expiry', async () => {
    for (const currentPeriodEnd of [new Date(Date.now() - 1), null]) {
      subscriptionFindUnique.mockResolvedValueOnce({
        ...subscription,
        status: BillingStatus.TRIALING,
        currentPeriodEnd,
      });
      await expect(assertSubscriptionAccess('tenant-1')).rejects.toMatchObject({
        code: 'SUBSCRIPTION_INACTIVE',
      });
    }
  });

  it('denies access when there is no subscription or no active mapped plan', async () => {
    subscriptionFindUnique.mockResolvedValueOnce(null);
    await expect(assertSubscriptionAccess('tenant-1')).rejects.toBeInstanceOf(BillingAccessDeniedError);

    subscriptionFindUnique.mockResolvedValueOnce({
      ...subscription,
      plan: { ...subscription.plan, active: false },
    });
    await expect(assertSubscriptionAccess('tenant-1')).rejects.toMatchObject({
      code: 'PLAN_UNAVAILABLE',
    });
  });

  it('checks configured capacity limits and treats null as unlimited', async () => {
    await expect(assertPlanCapacity('tenant-1', 'students')).resolves.toBeUndefined();
    studentCount.mockResolvedValueOnce(2);
    await expect(assertPlanCapacity('tenant-1', 'students'))
      .rejects.toBeInstanceOf(PlanLimitExceededError);

    subscriptionFindUnique.mockResolvedValueOnce({
      ...subscription,
      plan: { ...subscription.plan, maxWorkouts: null },
    });
    workoutCount.mockResolvedValueOnce(1000);
    await expect(assertPlanCapacity('tenant-1', 'workouts')).resolves.toBeUndefined();
  });

  it('rejects empty tenant identifiers before database access', async () => {
    await expect(getBillingOverview(' ')).rejects.toThrow(/tenantId é obrigatório/);
    expect(scopedPrisma).not.toHaveBeenCalled();
  });
});
