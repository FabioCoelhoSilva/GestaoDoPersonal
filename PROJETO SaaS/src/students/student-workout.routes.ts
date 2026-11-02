import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import {
  BillingAccessDeniedError,
  PlanLimitExceededError,
} from '../billing/subscription.service';
import {
  CreateStudentData,
  CreateWorkoutPlanData,
  UpdateStudentData,
  UpdateWorkoutExerciseData,
  UpdateWorkoutPlanData,
  archiveWorkoutPlan,
  createStudent,
  createWorkoutExercise,
  createWorkoutPlan,
  deactivateStudent,
  deleteWorkoutExercise,
  getStudent,
  getWorkoutPlan,
  listWorkoutExercises,
  listWorkoutPlans,
  listStudents,
  StudentWorkoutValidationError,
  TenantStudentNotFoundError,
  TenantStudentRecordNotFoundError,
  TenantWorkoutExerciseNotFoundError,
  TenantWorkoutNotFoundError,
  updateStudent,
  updateWorkoutExercise,
  updateWorkoutPlan,
  WorkoutHistoryConflictError,
} from './student-workout.service';

type TenantRequest = Request & {
  tenantId?: string;
};

type StudentWorkoutService = {
  createStudent: (tenantId: string, data: CreateStudentData) => Promise<unknown>;
  listStudents: (tenantId: string) => Promise<unknown[]>;
  getStudent: (tenantId: string, studentId: string) => Promise<unknown>;
  updateStudent: (tenantId: string, studentId: string, data: UpdateStudentData) => Promise<unknown>;
  deactivateStudent: (tenantId: string, studentId: string) => Promise<unknown>;
  createWorkoutPlan: (tenantId: string, data: CreateWorkoutPlanData) => Promise<unknown>;
  listWorkoutPlans: (tenantId: string) => Promise<unknown[]>;
  getWorkoutPlan: (tenantId: string, workoutId: string) => Promise<unknown>;
  updateWorkoutPlan: (
    tenantId: string,
    workoutId: string,
    data: UpdateWorkoutPlanData,
  ) => Promise<unknown>;
  archiveWorkoutPlan: (tenantId: string, workoutId: string) => Promise<unknown>;
  listWorkoutExercises: (tenantId: string, workoutId: string) => Promise<unknown[]>;
  createWorkoutExercise: (
    tenantId: string,
    workoutId: string,
    input: CreateWorkoutPlanData['exercises'][number],
  ) => Promise<unknown>;
  updateWorkoutExercise: (
    tenantId: string,
    exerciseId: string,
    data: UpdateWorkoutExerciseData,
  ) => Promise<unknown>;
  deleteWorkoutExercise: (tenantId: string, exerciseId: string) => Promise<unknown>;
};

const service: StudentWorkoutService = {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  deactivateStudent,
  createWorkoutPlan,
  listWorkoutPlans,
  getWorkoutPlan,
  updateWorkoutPlan,
  archiveWorkoutPlan,
  listWorkoutExercises,
  createWorkoutExercise,
  updateWorkoutExercise,
  deleteWorkoutExercise,
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

const studentUpdateSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.email().max(320).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Informe pelo menos um campo');

const workoutUpdateSchema = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Informe pelo menos um campo');

const workoutExerciseUpdateSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  gifUrl: z.url().max(2048).refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'gifUrl deve ser uma URL HTTPS válida').nullable().optional(),
  sets: z.number().int().min(1).max(100).optional(),
  reps: z.string().trim().min(1).max(32).optional(),
  restSeconds: z.number().int().min(0).max(7200).nullable().optional(),
  order: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Informe pelo menos um campo');

const workoutIdParamSchema = z.string().trim().min(1).max(64);

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
  if (error instanceof TenantStudentRecordNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof TenantWorkoutNotFoundError ||
    error instanceof TenantWorkoutExerciseNotFoundError
  ) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof WorkoutHistoryConflictError) {
    return res.status(409).json({ error: error.message });
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
  serviceOverrides: Partial<StudentWorkoutService> = {},
) {
  const studentService = { ...service, ...serviceOverrides };
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

  router.get('/students/:studentId', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.studentId);
    if (!parsedId.success) return res.status(400).json({ error: 'studentId inválido' });
    try {
      const student = await studentService.getStudent(tenantId, parsedId.data);
      if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });
      return res.status(200).json({ data: publicStudent(student) });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.patch('/students/:studentId', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.studentId);
    if (!parsedId.success) return res.status(400).json({ error: 'studentId inválido' });
    const parsed = studentUpdateSchema.safeParse(req.body);
    if (!parsed.success) return invalidBody(res, parsed.error);
    try {
      const student = await studentService.updateStudent(
        tenantId,
        parsedId.data,
        parsed.data,
      );
      return res.status(200).json({ data: publicStudent(student) });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.delete('/students/:studentId', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.studentId);
    if (!parsedId.success) return res.status(400).json({ error: 'studentId inválido' });
    try {
      const student = await studentService.deactivateStudent(tenantId, parsedId.data);
      return res.status(200).json({ data: publicStudent(student) });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.get('/workouts', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      const workouts = await studentService.listWorkoutPlans(tenantId);
      return res.status(200).json({ data: workouts });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.get('/workouts/:workoutId', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.workoutId);
    if (!parsedId.success) return res.status(400).json({ error: 'workoutId inválido' });
    try {
      const workout = await studentService.getWorkoutPlan(tenantId, parsedId.data);
      if (!workout) return res.status(404).json({ error: 'Treino não encontrado' });
      return res.status(200).json({ data: workout });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.patch('/workouts/:workoutId', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.workoutId);
    if (!parsedId.success) return res.status(400).json({ error: 'workoutId inválido' });
    const parsed = workoutUpdateSchema.safeParse(req.body);
    if (!parsed.success) return invalidBody(res, parsed.error);
    try {
      const workout = await studentService.updateWorkoutPlan(
        tenantId,
        parsedId.data,
        parsed.data,
      );
      return res.status(200).json({ data: workout });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.delete('/workouts/:workoutId', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.workoutId);
    if (!parsedId.success) return res.status(400).json({ error: 'workoutId inválido' });
    try {
      const workout = await studentService.archiveWorkoutPlan(tenantId, parsedId.data);
      return res.status(200).json({ data: workout });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.get('/workouts/:workoutId/exercises', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.workoutId);
    if (!parsedId.success) return res.status(400).json({ error: 'workoutId inválido' });
    try {
      const exercises = await studentService.listWorkoutExercises(tenantId, parsedId.data);
      return res.status(200).json({ data: exercises });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.post('/workouts/:workoutId/exercises', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.workoutId);
    if (!parsedId.success) return res.status(400).json({ error: 'workoutId inválido' });
    const parsed = exerciseSchema.safeParse(req.body);
    if (!parsed.success) return invalidBody(res, parsed.error);
    try {
      const exercise = await studentService.createWorkoutExercise(
        tenantId,
        parsedId.data,
        parsed.data,
      );
      return res.status(201).json({ data: exercise });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.patch('/workout-exercises/:exerciseId', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.exerciseId);
    if (!parsedId.success) return res.status(400).json({ error: 'exerciseId inválido' });
    const parsed = workoutExerciseUpdateSchema.safeParse(req.body);
    if (!parsed.success) return invalidBody(res, parsed.error);
    try {
      const exercise = await studentService.updateWorkoutExercise(
        tenantId,
        parsedId.data,
        parsed.data,
      );
      return res.status(200).json({ data: exercise });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.delete('/workout-exercises/:exerciseId', async (req: TenantRequest, res, next) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const parsedId = workoutIdParamSchema.safeParse(req.params.exerciseId);
    if (!parsedId.success) return res.status(400).json({ error: 'exerciseId inválido' });
    try {
      await studentService.deleteWorkoutExercise(tenantId, parsedId.data);
      return res.status(204).end();
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
