import { apiRequest } from '@/lib/api/client';

export type PerformanceReport = {
  period: { from: string; to: string };
  students: Array<{
    studentId: string;
    studentName: string;
    workoutSessions: number;
    completedWorkouts: number;
    inProgressWorkouts: number;
    appointments: { completed: number; scheduled: number; cancelled: number };
    evolution: Array<{
      exercise: string;
      firstLoadKg: number;
      latestLoadKg: number;
      changeKg: number;
      changePercent: number | null;
      observations: number;
    }>;
  }>;
  attendance: {
    completed: number;
    scheduled: number;
    cancelled: number;
    total: number;
    completionRate: number | null;
  };
  finance: {
    confirmedRevenue: string;
    confirmedPayments: number;
    overdueAmount: string;
    overduePayments: number;
  };
};

export const reportsService = {
  summary: (from: Date, to: Date) => {
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    return apiRequest<PerformanceReport>(`reports?${query.toString()}`);
  },
};
