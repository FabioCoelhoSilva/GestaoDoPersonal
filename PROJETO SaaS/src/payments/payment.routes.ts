import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AuthContext } from '../auth/auth-context';
import {
  BillingAccessDeniedError,
  PlanLimitExceededError,
} from '../billing/subscription.service';
import {
  confirmPayment,
  createMonthlyContract,
  listPayments,
  PaymentRecordNotFoundError,
  PaymentStateConflictError,
  PaymentValidationError,
} from './payment.service';

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

const createContractSchema = z.strictObject({
  studentId: z.string().trim().min(1).max(64),
  cycle: z.enum(['MONTHS_3', 'MONTHS_6', 'MONTHS_12']),
  monthlyAmount: z.number().positive().max(1_000_000),
  startDate: z.iso.datetime({ offset: true }),
});

function handlePaymentError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof PaymentValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof PaymentRecordNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof PaymentStateConflictError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof BillingAccessDeniedError) {
    return res.status(402).json({ error: error.message, code: error.code });
  }
  if (error instanceof PlanLimitExceededError) {
    return res.status(409).json({ error: error.message, code: 'PLAN_LIMIT_EXCEEDED' });
  }
  if (error instanceof Error && error.name === 'TenantStudentUnavailableError') {
    return res.status(404).json({ error: error.message });
  }
  return next(error);
}

export function createPaymentRouter() {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const tenantId = requirePersonal(req, res);
    if (!tenantId) return;
    const parsedFilter = z.enum(['PENDING', 'CONFIRMED', 'OVERDUE']).optional().safeParse(req.query.status);
    if (!parsedFilter.success) return res.status(400).json({ error: 'status inválido' });
    if (Object.keys(req.query).some((key) => key !== 'status')) {
      return res.status(400).json({ error: 'Parâmetros de consulta inválidos' });
    }

    try {
      return res.status(200).json({ data: await listPayments(tenantId, parsedFilter.data) });
    } catch (error) {
      return handlePaymentError(error, res, next);
    }
  });

  router.post('/contracts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const tenantId = requirePersonal(req, res);
    if (!tenantId) return;
    const parsed = createContractSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados do contrato inválidos', detalhes: parsed.error.flatten() });
    }

    try {
      const contract = await createMonthlyContract(tenantId, parsed.data);
      return res.status(201).json({ data: contract });
    } catch (error) {
      return handlePaymentError(error, res, next);
    }
  });

  router.patch('/:paymentId/confirm', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const tenantId = requirePersonal(req, res);
    if (!tenantId) return;
    if (Object.keys(req.body ?? {}).length > 0) {
      return res.status(400).json({ error: 'Esta rota não aceita corpo' });
    }
    const paymentId = z.string().trim().min(1).max(64).safeParse(req.params.paymentId);
    if (!paymentId.success) return res.status(400).json({ error: 'paymentId inválido' });

    try {
      return res.status(200).json({ data: await confirmPayment(tenantId, paymentId.data) });
    } catch (error) {
      return handlePaymentError(error, res, next);
    }
  });

  return router;
}

export const paymentRouter = createPaymentRouter();
