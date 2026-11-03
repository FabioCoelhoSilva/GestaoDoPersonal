import { ParcelStatus, WorkoutExecutionStatus } from '@prisma/client';
import { scopedPrisma } from '../db/scoped-prisma';

const MAX_EXECUTIONS = 10_000;

export type ReportPeriod = { from: Date; to: Date };

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationError';
  }
}

export class ReportRangeTooLargeError extends Error {
  constructor() {
    super('O período contém demasiados treinos para gerar o relatório. Reduza o intervalo de datas.');
    this.name = 'ReportRangeTooLargeError';
  }
}

function requirePeriod(period: ReportPeriod) {
  if (!(period.from instanceof Date) || !Number.isFinite(period.from.getTime())) {
    throw new ReportValidationError('from inválido');
  }
  if (!(period.to instanceof Date) || !Number.isFinite(period.to.getTime())) {
    throw new ReportValidationError('to inválido');
  }
  if (period.from >= period.to) {
    throw new ReportValidationError('from deve ser anterior a to');
  }
  if (period.to.getTime() - period.from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new ReportValidationError('O período máximo do relatório é de 366 dias');
  }
}

function decimalString(value: { toFixed: (digits: number) => string } | null) {
  return value?.toFixed(2) ?? '0.00';
}

type ExercisePoint = { at: Date; loadKg: number };
type StudentProgress = {
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
};

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export class PerformanceReportsService {
  private readonly db: ReturnType<typeof scopedPrisma>;

  constructor(tenantId: string) {
    if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new ReportValidationError('tenantId é obrigatório para consultar os relatórios');
    }
    this.db = scopedPrisma(tenantId);
  }

  async summary(period: ReportPeriod) {
    requirePeriod(period);
    const now = new Date();
    const [students, appointments, executions, confirmedParcels, confirmedExtras, overdueParcels, overdueExtras] =
      await Promise.all([
        this.db.student.findMany({
          where: { active: true, anonymizedAt: null },
          select: { id: true, name: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        this.db.appointment.groupBy({
          by: ['studentId', 'status'],
          where: { startsAt: { gte: period.from, lt: period.to } },
          _count: { _all: true },
        }),
        this.db.workoutExecution.findMany({
          where: { startedAt: { gte: period.from, lt: period.to } },
          orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
          take: MAX_EXECUTIONS + 1,
          select: {
            id: true,
            studentId: true,
            status: true,
            startedAt: true,
            setLogs: {
              select: {
                loadKg: true,
                workoutExercise: { select: { name: true } },
              },
            },
          },
        }),
        this.db.paymentParcel.aggregate({
          where: {
            status: ParcelStatus.CONFIRMED,
            confirmedAt: { gte: period.from, lt: period.to },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        this.db.extraPayment.aggregate({
          where: {
            status: ParcelStatus.CONFIRMED,
            confirmedAt: { gte: period.from, lt: period.to },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        this.db.paymentParcel.aggregate({
          where: {
            status: { in: [ParcelStatus.PENDING, ParcelStatus.FAILED] },
            dueDate: { lt: now },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        this.db.extraPayment.aggregate({
          where: {
            status: { in: [ParcelStatus.PENDING, ParcelStatus.FAILED] },
            dueDate: { lt: now },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

    if (executions.length > MAX_EXECUTIONS) throw new ReportRangeTooLargeError();

    const activeStudentIds = new Set(students.map((student) => student.id));
    const progressByStudent = new Map<string, StudentProgress>();
    for (const student of students) {
      progressByStudent.set(student.id, {
        studentId: student.id,
        studentName: student.name,
        workoutSessions: 0,
        completedWorkouts: 0,
        inProgressWorkouts: 0,
        appointments: { completed: 0, scheduled: 0, cancelled: 0 },
        evolution: [],
      });
    }

    for (const entry of appointments) {
      const progress = progressByStudent.get(entry.studentId);
      if (!progress) continue;
      progress.appointments[entry.status.toLowerCase() as keyof StudentProgress['appointments']] =
        entry._count._all;
    }

    const pointsByStudent = new Map<string, Map<string, ExercisePoint[]>>();
    for (const execution of executions) {
      if (!activeStudentIds.has(execution.studentId)) continue;
      const progress = progressByStudent.get(execution.studentId)!;
      progress.workoutSessions += 1;
      if (execution.status === WorkoutExecutionStatus.COMPLETED) progress.completedWorkouts += 1;
      else progress.inProgressWorkouts += 1;

      const maxLoadByExercise = new Map<string, number>();
      for (const log of execution.setLogs) {
        if (log.loadKg === null) continue;
        const load = Number(log.loadKg);
        if (!Number.isFinite(load) || load < 0) continue;
        const exercise = log.workoutExercise.name;
        maxLoadByExercise.set(exercise, Math.max(maxLoadByExercise.get(exercise) ?? 0, load));
      }

      let studentPoints = pointsByStudent.get(execution.studentId);
      if (!studentPoints) {
        studentPoints = new Map();
        pointsByStudent.set(execution.studentId, studentPoints);
      }
      for (const [exercise, loadKg] of maxLoadByExercise) {
        const points = studentPoints.get(exercise) ?? [];
        points.push({ at: execution.startedAt, loadKg });
        studentPoints.set(exercise, points);
      }
    }

    for (const [studentId, exercises] of pointsByStudent) {
      const progress = progressByStudent.get(studentId)!;
      progress.evolution = [...exercises.entries()]
        .map(([exercise, points]) => {
          points.sort((a, b) => a.at.getTime() - b.at.getTime());
          const firstLoadKg = points[0].loadKg;
          const latestLoadKg = points[points.length - 1].loadKg;
          const changeKg = round(latestLoadKg - firstLoadKg);
          return {
            exercise,
            firstLoadKg: round(firstLoadKg),
            latestLoadKg: round(latestLoadKg),
            changeKg,
            changePercent: firstLoadKg === 0 ? null : round((changeKg / firstLoadKg) * 100, 1),
            observations: points.length,
          };
        })
        .sort((a, b) => a.exercise.localeCompare(b.exercise, 'pt'));
    }

    const appointmentTotals = {
      completed: 0,
      scheduled: 0,
      cancelled: 0,
    };
    for (const entry of appointments) {
      appointmentTotals[entry.status.toLowerCase() as keyof typeof appointmentTotals] += entry._count._all;
    }

    const completedAppointments = appointmentTotals.completed;
    const attendedAppointments = completedAppointments + appointmentTotals.cancelled;
    const confirmedRevenue = (Number(decimalString(confirmedParcels._sum.amount)) +
      Number(decimalString(confirmedExtras._sum.amount))).toFixed(2);
    const overdueAmount = (Number(decimalString(overdueParcels._sum.amount)) +
      Number(decimalString(overdueExtras._sum.amount))).toFixed(2);

    return {
      period: { from: period.from, to: period.to },
      students: [...progressByStudent.values()],
      attendance: {
        ...appointmentTotals,
        total: appointmentTotals.completed + appointmentTotals.scheduled + appointmentTotals.cancelled,
        completionRate: attendedAppointments === 0 ? null : round(completedAppointments / attendedAppointments, 4),
      },
      finance: {
        confirmedRevenue,
        confirmedPayments: confirmedParcels._count._all + confirmedExtras._count._all,
        overdueAmount,
        overduePayments: overdueParcels._count._all + overdueExtras._count._all,
      },
    };
  }
}
