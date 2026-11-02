import { WorkoutExecutionStatus } from '@prisma/client';
import { scopedPrisma } from '../db/scoped-prisma';

export type DashboardMetrics = {
  activeStudents: number;
  workoutPlans: number;
  sessions: {
    executed: number;
    inProgress: number;
    total: number;
  };
};

export class DashboardMetricsService {
  private readonly db: ReturnType<typeof scopedPrisma>;

  constructor(tenantId: string) {
    if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new Error('tenantId é obrigatório para consultar as métricas do dashboard');
    }
    this.db = scopedPrisma(tenantId);
  }

  async summary(): Promise<DashboardMetrics> {
    const [activeStudents, workoutPlans, executedSessions, inProgressSessions] = await Promise.all([
      this.db.student.count({
        where: { active: true, anonymizedAt: null },
      }),
      this.db.workout.count(),
      this.db.workoutExecution.count({
        where: { status: WorkoutExecutionStatus.COMPLETED },
      }),
      this.db.workoutExecution.count({
        where: { status: WorkoutExecutionStatus.IN_PROGRESS },
      }),
    ]);

    return {
      activeStudents,
      workoutPlans,
      sessions: {
        executed: executedSessions,
        inProgress: inProgressSessions,
        total: executedSessions + inProgressSessions,
      },
    };
  }
}
