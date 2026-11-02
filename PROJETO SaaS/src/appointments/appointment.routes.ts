import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AuthContext } from '../auth/auth-context';
import {
  AppointmentRecordNotFoundError,
  AppointmentStateConflictError,
  AppointmentValidationError,
  createAppointment,
  listAppointments,
  updateAppointmentStatus,
} from './appointment.service';
import {
  AppointmentTimeConflictError,
  TenantStudentUnavailableError,
  TenantWorkoutUnavailableError,
} from '../db/scoped-prisma';

type AuthenticatedRequest = Request & { auth?: AuthContext; tenantId?: string };

function requirePersonal(req: AuthenticatedRequest, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: 'Autenticação obrigatória' });
    return null;
  }
  if (req.auth.role !== 'PERSONAL') {
    res.status(403).json({ error: 'Acesso restrito ao personal do tenant' });
    return null;
  }
  if (!req.tenantId || req.tenantId !== req.auth.tenantId) {
    res.status(403).json({ error: 'Tenant autenticado inválido' });
    return null;
  }
  return req.tenantId;
}

const dateTimeSchema = z.iso.datetime({ offset: true });
const createAppointmentSchema = z.strictObject({
  studentId: z.string().trim().min(1).max(64),
  workoutId: z.string().trim().min(1).max(64).nullable().optional(),
  title: z.string().trim().min(2).max(160),
  startsAt: dateTimeSchema,
  endsAt: dateTimeSchema,
  notes: z.string().trim().max(2000).nullable().optional(),
});
const statusSchema = z.strictObject({ status: z.enum(['COMPLETED', 'CANCELLED']) });

function handleAppointmentError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof AppointmentValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof AppointmentTimeConflictError) {
    return res.status(409).json({ error: error.message, code: 'APPOINTMENT_TIME_CONFLICT' });
  }
  if (error instanceof TenantStudentUnavailableError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof TenantWorkoutUnavailableError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof AppointmentRecordNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof AppointmentStateConflictError) {
    return res.status(409).json({ error: error.message });
  }
  return next(error);
}

export function createAppointmentRouter() {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const tenantId = requirePersonal(req, res);
    if (!tenantId) return;
    const querySchema = z.strictObject({
      from: dateTimeSchema,
      to: dateTimeSchema,
    });
    const query = querySchema.safeParse(req.query);
    if (!query.success) return res.status(400).json({ error: 'Informe um intervalo from/to válido' });

    try {
      return res.status(200).json({
        data: await listAppointments(tenantId, query.data.from, query.data.to),
      });
    } catch (error) {
      return handleAppointmentError(error, res, next);
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const tenantId = requirePersonal(req, res);
    if (!tenantId) return;
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados da aula inválidos', detalhes: parsed.error.flatten() });
    }

    try {
      return res.status(201).json({ data: await createAppointment(tenantId, parsed.data) });
    } catch (error) {
      return handleAppointmentError(error, res, next);
    }
  });

  router.patch('/:appointmentId/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const tenantId = requirePersonal(req, res);
    if (!tenantId) return;
    const appointmentId = z.string().trim().min(1).max(64).safeParse(req.params.appointmentId);
    const parsed = statusSchema.safeParse(req.body);
    if (!appointmentId.success || !parsed.success) {
      return res.status(400).json({ error: 'Dados de alteração de estado inválidos' });
    }

    try {
      return res.status(200).json({
        data: await updateAppointmentStatus(tenantId, appointmentId.data, parsed.data.status),
      });
    } catch (error) {
      return handleAppointmentError(error, res, next);
    }
  });

  return router;
}

export const appointmentRouter = createAppointmentRouter();
