import { ContractStatus, ExamStatus, ParcelStatus } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { type AuthenticatedRequest } from './auth';
import { getScopedPrisma, logScopedAccess } from '../db/scoped-prisma';

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_AFTER_DAYS = 30;
const UPCOMING_CONTRACT_DAYS = 30;
const PAGE_SIZE = 50;

const createStudentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
});

function auth(req: AuthenticatedRequest) {
  if (!req.auth) throw new Error('Authenticated request is missing its auth context');
  return req.auth;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function recentMonths(now: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + index + 1, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''),
      receivedCents: 0,
    };
  });
}

function cents(value: { toString(): string }) {
  const result = Number(value.toString());
  if (!Number.isFinite(result)) throw new Error('O banco retornou um valor monetário inválido.');
  return Math.round(result * 100);
}

function amount(value: { toString(): string }) {
  return cents(value) / 100;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function sum(rows: Array<{ amount: { toString(): string } }>) {
  return rows.reduce((total, row) => total + cents(row.amount), 0) / 100;
}

async function getFinanceData(personalId: string, now: Date) {
  const db = getScopedPrisma(personalId);
  const chartMonths = recentMonths(now, 6);
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const confirmedWhere = {
    status: ParcelStatus.CONFIRMED,
    confirmedAt: { gte: firstMonth, lte: now },
  };
  const outstandingWhere = { status: { in: [ParcelStatus.PENDING, ParcelStatus.FAILED] } };

  const [
    confirmedParcels,
    confirmedExtras,
    outstandingParcels,
    outstandingExtras,
    overdueParcels,
    overdueExtras,
    monthlyContracts,
    recentParcels,
    recentExtras,
  ] = await Promise.all([
    db.paymentParcel.findMany({
      where: confirmedWhere,
      select: { amount: true, confirmedAt: true },
    }),
    db.extraPayment.findMany({
      where: confirmedWhere,
      select: { amount: true, confirmedAt: true },
    }),
    db.paymentParcel.findMany({
      where: outstandingWhere,
      select: { amount: true },
    }),
    db.extraPayment.findMany({
      where: outstandingWhere,
      select: { amount: true },
    }),
    db.paymentParcel.count({
      where: { ...outstandingWhere, dueDate: { lt: now } },
    }),
    db.extraPayment.count({
      where: { ...outstandingWhere, dueDate: { lt: now } },
    }),
    db.contract.findMany({
      where: {
        status: ContractStatus.SIGNED,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { monthlyAmount: true },
    }),
    db.paymentParcel.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        dueDate: true,
        confirmedAt: true,
        status: true,
        contract: { select: { student: { select: { name: true } } } },
      },
    }),
    db.extraPayment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        dueDate: true,
        confirmedAt: true,
        status: true,
        description: true,
        student: { select: { name: true } },
      },
    }),
  ]);

  for (const payment of [...confirmedParcels, ...confirmedExtras]) {
    if (!payment.confirmedAt) continue;
    const month = chartMonths.find((item) => item.key === monthKey(payment.confirmedAt!));
    if (month) month.receivedCents += cents(payment.amount);
  }

  const transactions = [
    ...recentParcels.map((payment) => ({
      id: payment.id,
      name: payment.contract.student.name,
      description: 'Parcela de contrato',
      date: payment.confirmedAt ?? payment.dueDate,
      value: amount(payment.amount),
      status: payment.status,
    })),
    ...recentExtras.map((payment) => ({
      id: payment.id,
      name: payment.student?.name ?? 'Pagamento avulso',
      description: payment.description ?? 'Receita avulsa',
      date: payment.confirmedAt ?? payment.dueDate ?? now,
      value: amount(payment.amount),
      status: payment.status,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)
    .map((payment) => ({
      ...payment,
      date: payment.date.toISOString(),
    }));

  return {
    monthlyRevenue: [...confirmedParcels, ...confirmedExtras]
      .filter((payment) => payment.confirmedAt && monthKey(payment.confirmedAt) === monthKey(now))
      .reduce((total, payment) => total + cents(payment.amount), 0) / 100,
    recurringRevenue:
      monthlyContracts.reduce((total, contract) => total + cents(contract.monthlyAmount), 0) / 100,
    receivable: sum(outstandingParcels) + sum(outstandingExtras),
    overdueCount: overdueParcels + overdueExtras,
    chart: chartMonths.map(({ receivedCents, ...month }) => ({
      ...month,
      received: receivedCents / 100,
    })),
    transactions,
  };
}

export function createApiRouter(requirePersonal: RequestHandler) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(requirePersonal);

  router.get('/me', async (req: AuthenticatedRequest, res, next) => {
    try {
      const current = auth(req);
      await logScopedAccess({
        userId: current.userId,
        personalId: current.personalId,
        action: 'READ',
        resource: 'profile',
        ip: req.ip,
      });
      res.json({ user: { name: current.name, email: current.email } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/dashboard', async (req: AuthenticatedRequest, res, next) => {
    try {
      const current = auth(req);
      const db = getScopedPrisma(current.personalId);
      const now = new Date();
      const currentMonth = monthStart(now);
      const thirtyDaysAgo = new Date(now.getTime() - REVIEW_AFTER_DAYS * DAY_MS);
      const contractLimit = new Date(now.getTime() + UPCOMING_CONTRACT_DAYS * DAY_MS);
      const financePromise = getFinanceData(current.personalId, now);

      const [
        studentsTotal,
        studentsActive,
        newStudents,
        activeWorkouts,
        staleWorkouts,
        staleWorkoutItems,
        activeContracts,
        upcomingContracts,
        pendingExams,
        finance,
      ] = await Promise.all([
        db.student.count({ where: { anonymizedAt: null } }),
        db.student.count({ where: { active: true, anonymizedAt: null } }),
        db.student.count({
          where: { createdAt: { gte: currentMonth }, anonymizedAt: null },
        }),
        db.workout.count({ where: { active: true } }),
        db.workout.count({
          where: { active: true, updatedAt: { lt: thirtyDaysAgo } },
        }),
        db.workout.findMany({
          where: { active: true, updatedAt: { lt: thirtyDaysAgo } },
          orderBy: { updatedAt: 'asc' },
          take: 5,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            student: { select: { name: true } },
          },
        }),
        db.contract.count({
          where: {
            status: ContractStatus.SIGNED,
            startDate: { lte: now },
            endDate: { gte: now },
          },
        }),
        db.contract.findMany({
          where: {
            status: ContractStatus.SIGNED,
            endDate: { gte: now, lte: contractLimit },
          },
          orderBy: { endDate: 'asc' },
          take: 5,
          select: {
            id: true,
            cycle: true,
            endDate: true,
            student: { select: { name: true } },
          },
        }),
        db.exam.count({ where: { status: ExamStatus.PENDING_REVIEW } }),
        financePromise,
      ]);

      await logScopedAccess({
        userId: current.userId,
        personalId: current.personalId,
        action: 'READ',
        resource: 'dashboard',
        purpose: 'gestao_operacional',
        ip: req.ip,
      });
      res.json({
        students: { total: studentsTotal, active: studentsActive, newThisMonth: newStudents },
        workouts: {
          active: activeWorkouts,
          needsReview: staleWorkouts,
          reviewItems: staleWorkoutItems.map((workout) => ({
            id: workout.id,
            title: workout.title,
            student: workout.student.name,
            updatedAt: workout.updatedAt.toISOString(),
          })),
        },
        contracts: {
          active: activeContracts,
          upcoming: upcomingContracts.map((contract) => ({
            id: contract.id,
            student: contract.student.name,
            cycle: contract.cycle,
            endDate: contract.endDate.toISOString(),
          })),
        },
        pendingExams,
        finance,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/students', async (req: AuthenticatedRequest, res, next) => {
    try {
      const current = auth(req);
      const requestedPage = Number(req.query.page);
      const page =
        Number.isSafeInteger(requestedPage) && requestedPage > 0
          ? Math.min(requestedPage, 1_000_000)
          : 1;
      const status = req.query.status;
      const active =
        status === 'Ativo' ? true : status === 'Inativo' ? false : undefined;
      const db = getScopedPrisma(current.personalId);
      const where = {
        anonymizedAt: null,
        ...(active === undefined ? {} : { active }),
      };
      const [total, allCount, items] = await Promise.all([
        db.student.count({ where }),
        db.student.count({ where: { anonymizedAt: null } }),
        db.student.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            createdAt: true,
            contracts: {
              orderBy: { startDate: 'desc' },
              take: 1,
              select: { cycle: true },
            },
          },
        }),
      ]);
      const currentMonth = monthStart(new Date());
      const [activeCount, newThisMonth] = await Promise.all([
        db.student.count({ where: { active: true, anonymizedAt: null } }),
        db.student.count({
          where: { createdAt: { gte: currentMonth }, anonymizedAt: null },
        }),
      ]);
      await logScopedAccess({
        userId: current.userId,
        personalId: current.personalId,
        action: 'READ',
        resource: 'students',
        ip: req.ip,
      });
      res.json({
        items: items.map((student) => ({
          id: student.id,
          name: student.name,
          email: student.email,
          active: student.active,
          createdAt: student.createdAt.toISOString(),
          plan: student.contracts[0]?.cycle ?? null,
        })),
        total,
        allCount,
        activeCount,
        newThisMonth,
        page,
        pageSize: PAGE_SIZE,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/students', async (req: AuthenticatedRequest, res, next) => {
    try {
      const current = auth(req);
      const parsed = createStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Informe um nome e um e-mail válido.' });
        return;
      }
      const db = getScopedPrisma(current.personalId);
      const student = await db.student.create({
        data: { ...parsed.data, personalId: current.personalId },
      });
      await logScopedAccess({
        userId: current.userId,
        personalId: current.personalId,
        action: 'WRITE',
        resource: 'student',
        resourceId: student.id,
        ip: req.ip,
      });
      res.status(201).json({
        id: student.id,
        name: student.name,
        email: student.email,
        active: student.active,
        createdAt: student.createdAt.toISOString(),
        plan: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/workouts', async (req: AuthenticatedRequest, res, next) => {
    try {
      const current = auth(req);
      const db = getScopedPrisma(current.personalId);
      const [items, total, active] = await Promise.all([
        db.workout.findMany({
          where: { active: true },
          orderBy: { updatedAt: 'desc' },
          take: 100,
          select: {
            id: true,
            title: true,
            description: true,
            updatedAt: true,
            student: { select: { id: true, name: true } },
          },
        }),
        db.workout.count({ where: { active: true } }),
        db.workout.count({ where: { active: true, updatedAt: { gte: new Date(Date.now() - REVIEW_AFTER_DAYS * DAY_MS) } } }),
      ]);
      await logScopedAccess({
        userId: current.userId,
        personalId: current.personalId,
        action: 'READ',
        resource: 'workouts',
        ip: req.ip,
      });
      res.json({
        items: items.map((workout) => ({
          ...workout,
          updatedAt: workout.updatedAt.toISOString(),
        })),
        total,
        active,
        needsReview: total - active,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/finance', async (req: AuthenticatedRequest, res, next) => {
    try {
      const current = auth(req);
      const finance = await getFinanceData(current.personalId, new Date());
      await logScopedAccess({
        userId: current.userId,
        personalId: current.personalId,
        action: 'READ',
        resource: 'finance',
        purpose: 'gestao_financeira',
        ip: req.ip,
      });
      res.json(finance);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
