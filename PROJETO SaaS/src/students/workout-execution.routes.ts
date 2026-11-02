import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import {
  CreateWorkoutExecutionInput,
  completeWorkoutExecution,
  createWorkoutExecution,
  listWorkoutExecutions,
  WorkoutExecutionNotFoundError,
  WorkoutExecutionValidationError,
} from './workout-execution.service';

type WorkoutExecutionService = {
  createWorkoutExecution: (
    tenantId: string,
    input: CreateWorkoutExecutionInput,
  ) => Promise<unknown>;
  listWorkoutExecutions: (tenantId: string, studentId?: string) => Promise<unknown[]>;
  completeWorkoutExecution: (
    tenantId: string,
    executionId: string,
    studentId?: string,
  ) => Promise<unknown>;
};

const defaultService: WorkoutExecutionService = {
  createWorkoutExecution,
  listWorkoutExecutions,
  completeWorkoutExecution,
};

const setSchema = z.strictObject({
  workoutExerciseId: z.string().trim().min(1).max(64),
  setNumber: z.number().int().min(1).max(100),
  repsCompleted: z.number().int().min(0).max(1000),
  loadKg: z.number().min(0).max(1000).multipleOf(0.01).nullable().optional(),
});

const createExecutionSchema = z.strictObject({
  workoutId: z.string().trim().min(1).max(64),
  studentId: z.string().trim().min(1).max(64).optional(),
  completed: z.boolean(),
  sets: z.array(setSchema).min(1).max(500),
});

function requireAuth(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: 'Autenticação obrigatória' });
    return null;
  }
  if (req.auth.role !== 'PERSONAL' && req.auth.role !== 'STUDENT') {
    res.status(403).json({ error: 'Acesso restrito a personal ou aluno autenticado' });
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
  return { tenantId: req.tenantId, auth: req.auth };
}

function sendServiceError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof WorkoutExecutionValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof WorkoutExecutionNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  return next(error);
}

export function createWorkoutExecutionRouter(
  service: WorkoutExecutionService = defaultService,
) {
  const router = Router();

  router.post('/workout-executions', async (req: Request, res: Response, next: NextFunction) => {
    const context = requireAuth(req, res);
    if (!context) return;

    const parsed = createExecutionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados da execução inválidos',
        detalhes: parsed.error.flatten(),
      });
    }

    if (context.auth.role === 'STUDENT' && parsed.data.studentId !== undefined) {
      return res.status(403).json({ error: 'O aluno só pode registar a própria execução' });
    }
    if (context.auth.role === 'STUDENT' && !context.auth.studentId) {
      return res.status(403).json({ error: 'Aluno autenticado sem vínculo ativo' });
    }
    if (context.auth.role === 'PERSONAL' && !parsed.data.studentId) {
      return res.status(400).json({ error: 'studentId é obrigatório para o personal' });
    }

    const studentId = context.auth.role === 'STUDENT'
      ? context.auth.studentId!
      : parsed.data.studentId!;
    const { studentId: _bodyStudentId, ...executionData } = parsed.data;
    const normalizedData: CreateWorkoutExecutionInput = {
      ...executionData,
      studentId,
      sets: executionData.sets.map((set) => ({ ...set, loadKg: set.loadKg ?? null })),
    };

    try {
      const execution = await service.createWorkoutExecution(context.tenantId, normalizedData);
      return res.status(201).json({ data: execution });
    } catch (error) {
      return sendServiceError(error, res, next);
    }
  });

  router.get('/workout-executions', async (req: Request, res: Response, next: NextFunction) => {
    const context = requireAuth(req, res);
    if (!context) return;

    const rawStudentId = req.query.studentId;
    if (rawStudentId !== undefined && typeof rawStudentId !== 'string') {
      return res.status(400).json({ error: 'studentId inválido' });
    }
    const requestedStudentId = typeof rawStudentId === 'string' ? rawStudentId : undefined;
    if (
      context.auth.role === 'STUDENT' &&
      requestedStudentId !== undefined &&
      requestedStudentId !== context.auth.studentId
    ) {
      return res.status(403).json({ error: 'O aluno só pode consultar o próprio histórico' });
    }
    if (context.auth.role === 'STUDENT' && !context.auth.studentId) {
      return res.status(403).json({ error: 'Aluno autenticado sem vínculo ativo' });
    }

    const studentId = context.auth.role === 'STUDENT'
      ? context.auth.studentId!
      : requestedStudentId;
    try {
      const executions = await service.listWorkoutExecutions(context.tenantId, studentId);
      return res.status(200).json({ data: executions });
    } catch (error) {
      return sendServiceError(error, res, next);
    }
  });

  router.patch(
    '/workout-executions/:executionId/complete',
    async (req: Request, res: Response, next: NextFunction) => {
      const context = requireAuth(req, res);
      if (!context) return;
      if (req.body !== undefined) {
        const parsedBody = z.strictObject({}).safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json({ error: 'Esta rota não aceita campos no body' });
        }
      }
      if (context.auth.role === 'STUDENT' && !context.auth.studentId) {
        return res.status(403).json({ error: 'Aluno autenticado sem vínculo ativo' });
      }

      try {
        const executionId = req.params.executionId;
        if (typeof executionId !== 'string') {
          return res.status(400).json({ error: 'executionId inválido' });
        }
        const execution = await service.completeWorkoutExecution(
          context.tenantId,
          executionId,
          context.auth.role === 'STUDENT' ? context.auth.studentId! : undefined,
        );
        return res.status(200).json({ data: execution });
      } catch (error) {
        return sendServiceError(error, res, next);
      }
    },
  );

  return router;
}

export const workoutExecutionRouter = createWorkoutExecutionRouter();
