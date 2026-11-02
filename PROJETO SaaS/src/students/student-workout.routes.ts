import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import {
  BillingAccessDeniedError,
  PlanLimitExceededError,
} from '../billing/subscription.service';
import {
  CreateStudentData,
  CreateWorkoutPlanData,
  createStudent,
  createWorkoutPlan,
  listStudents,
  StudentWorkoutValidationError,
  TenantStudentNotFoundError,
} from './student-workout.service';

type TenantRequest = Request & {
  tenantId?: string;
};

type StudentWorkoutService = {
  createStudent: (tenantId: string, data: CreateStudentData) => Promise<unknown>;
  listStudents: (tenantId: string) => Promise<unknown[]>;
  createWorkoutPlan: (tenantId: string, data: CreateWorkoutPlanData) => Promise<unknown>;
};

const service: StudentWorkoutService = {
  createStudent,
  listStudents,
  createWorkoutPlan,
};

const studentBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(320),
});

const exerciseSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  gifUrl: z.url().max(2048).refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'gifUrl deve ser uma URL HTTPS válida').nullable().optional(),
  sets: z.number().int().min(1).max(100),
  reps: z.string().trim().min(1).max(32),
  restSeconds: z.number().int().min(0).max(7200).nullable().optional(),
  order: z.number().int().nonnegative(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const workoutBodySchema = z.strictObject({
  studentId: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  active: z.boolean().optional(),
  exercises: z.array(exerciseSchema).min(1),
});

function requireTenant(req: TenantRequest, res: Response): string | null {
  if (!req.auth) {
    res.status(401).json({ error: 'Autenticação obrigatória' });
    return null;
  }
  if (req.auth.role !== 'PERSONAL') {
    res.status(403).json({ error: 'Acesso restrito a personal autenticado' });
    return null;
  }
  if (
    typeof req.tenantId !== 'string' ||
    req.tenantId.trim().length === 0 ||
    req.auth.tenantId !== req.tenantId
  ) {
    res.status(403).json({ error: 'Tenant autenticado não encontrado na requisição' });
    return null;
  }
  return req.tenantId;
}

function invalidBody(res: Response, error: z.ZodError) {
  return res.status(400).json({
    error: 'Dados da requisição inválidos',
    detalhes: error.flatten(),
  });
}

function publicStudent(student: unknown) {
  if (typeof student !== 'object' || student === null) return student;
  return Object.fromEntries(
    Object.entries(student).filter(([field]) => field !== 'cpfEncrypted' && field !== 'cpfHash'),
  );
}

function handleServiceError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof BillingAccessDeniedError) {
    return res.status(402).json({ error: error.message, code: error.code });
  }
  if (error instanceof PlanLimitExceededError) {
    return res.status(409).json({
      error: error.message,
      code: 'PLAN_LIMIT_EXCEEDED',
      resource: error.resource,
      limit: error.limit,
      current: error.current,
    });
  }
  if (error instanceof StudentWorkoutValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof TenantStudentNotFoundError) {
    return res.status(403).json({ error: error.message });
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  ) {
    return res.status(409).json({ error: 'Já existe um registo com estes dados únicos' });
  }
  return next(error);
}

export function createStudentWorkoutRouter(
  studentService: StudentWorkoutService = service,
) {
  const router = Router();

  router.post('/students', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;

    const parsed = studentBodySchema.safeParse(req.body);
    if (!parsed.success) return invalidBody(res, parsed.error);

    try {
      const student = await studentService.createStudent(tenantId, parsed.data);
      return res.status(201).json({ data: publicStudent(student) });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.get('/students', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;

    try {
      const students = await studentService.listStudents(tenantId);
      return res.status(200).json({ data: students.map(publicStudent) });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.post('/workouts', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;

    const parsed = workoutBodySchema.safeParse(req.body);
    if (!parsed.success) return invalidBody(res, parsed.error);

    try {
      const workout = await studentService.createWorkoutPlan(tenantId, parsed.data);
      return res.status(201).json({ data: workout });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  return router;
}

export const studentWorkoutRouter = createStudentWorkoutRouter();
