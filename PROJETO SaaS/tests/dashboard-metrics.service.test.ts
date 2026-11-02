import { beforeEach, describe, expect, it, vi } from 'vitest';

const { scopedPrisma, studentCount, workoutCount, executionCount } = vi.hoisted(() => ({
  scopedPrisma: vi.fn(),
  studentCount: vi.fn(),
  workoutCount: vi.fn(),
  executionCount: vi.fn(),
}));

vi.mock('../src/db/scoped-prisma', () => ({ scopedPrisma }));

import { DashboardMetricsService } from '../src/dashboard/dashboard-metrics.service';

beforeEach(() => {
  vi.clearAllMocks();
  studentCount.mockResolvedValue(7);
  workoutCount.mockResolvedValue(12);
  executionCount.mockResolvedValueOnce(9).mockResolvedValueOnce(2);
  scopedPrisma.mockReturnValue({
    student: { count: studentCount },
    workout: { count: workoutCount },
    workoutExecution: { count: executionCount },
  });
});

describe('DashboardMetricsService', () => {
  it('uses the tenant-scoped client and aggregates active students, plans, and sessions', async () => {
    const service = new DashboardMetricsService('tenant-1');

    await expect(service.summary()).resolves.toEqual({
      activeStudents: 7,
      workoutPlans: 12,
      sessions: { executed: 9, inProgress: 2, total: 11 },
    });

    expect(scopedPrisma).toHaveBeenCalledWith('tenant-1');
    expect(studentCount).toHaveBeenCalledWith({
      where: { active: true, anonymizedAt: null },
    });
    expect(workoutCount).toHaveBeenCalledWith();
    expect(executionCount).toHaveBeenNthCalledWith(1, {
      where: { status: 'COMPLETED' },
    });
    expect(executionCount).toHaveBeenNthCalledWith(2, {
      where: { status: 'IN_PROGRESS' },
    });
  });

  it('rejects an empty tenant before touching Prisma', () => {
    expect(() => new DashboardMetricsService(' ')).toThrow(/tenantId é obrigatório/);
    expect(scopedPrisma).not.toHaveBeenCalled();
  });
});
