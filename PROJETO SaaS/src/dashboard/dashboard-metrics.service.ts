import { scopedPrisma } from '../db/scoped-prisma';

export class DashboardMetricsService {
  constructor(private personalId: string) {
    if (!this.personalId || this.personalId.trim() === '') {
      throw new Error('tenantId é obrigatório para consultar o dashboard');
    }
  }

  async summary() {
    const db = scopedPrisma(this.personalId);
    
    const [activeStudents, workoutPlans, executedSessions, inProgressSessions] = await Promise.all([
      db.student.count({ where: { active: true, anonymizedAt: null } }),
      db.workout.count(),
      db.workoutExecution.count({ where: { status: 'COMPLETED' } }),
      db.workoutExecution.count({ where: { status: 'IN_PROGRESS' } })
    ]);

    const totalSessions = executedSessions + inProgressSessions;

    return {
      activeStudents,
      activeWorkouts: workoutPlans,
      monthlySessions: totalSessions,
      growthRate: 0
    };
  }
}