import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AuthContext } from '../auth/auth-context';
import { logAccess } from '../db/scoped-prisma';
import {
  PerformanceReportsService,
  ReportRangeTooLargeError,
  ReportValidationError,
} from './performance-reports.service';

type AuthenticatedRequest = Request & { auth?: AuthContext; tenantId?: string };

export type ReportsReader = {
  summary: (period: { from: Date; to: Date }) => Promise<unknown>;
};

const querySchema = z.strictObject({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});
const DAY_MS = 24 * 60 * 60 * 1000;

function requirePersonal(req: AuthenticatedRequest, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: 'Autenticação obrigatória' });
    return null;
  }
  if (req.auth.role !== 'PERSONAL') {
    res.status(403).json({ error: 'Acesso restrito ao personal do tenant' });
    return null;
  }
  if (!req.auth.tenantId || !req.tenantId || req.auth.tenantId !== req.tenantId) {
    res.status(403).json({ error: 'Tenant autenticado inválido' });
    return null;
  }
  return { userId: req.auth.userId, tenantId: req.auth.tenantId };
}

function resolvePeriod(query: z.infer<typeof querySchema>) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 90 * DAY_MS);
  return { from, to };
}

function handleReportsError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof ReportValidationError) {
    return res.status(400).json({ error: error.message, code: 'INVALID_REPORT_PERIOD' });
  }
  if (error instanceof ReportRangeTooLargeError) {
    return res.status(422).json({ error: error.message, code: 'REPORT_RANGE_TOO_LARGE' });
  }
  return next(error);
}

export function createPerformanceReportsRouter(
  createReader: (tenantId: string) => ReportsReader =
    (tenantId) => new PerformanceReportsService(tenantId),
  writeAudit: typeof logAccess = logAccess,
) {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = requirePersonal(req, res);
    if (!identity) return;
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parâmetros do relatório inválidos', details: parsed.error.flatten() });
    }

    const period = resolvePeriod(parsed.data);
    try {
      const report = await createReader(identity.tenantId).summary(period);
      await writeAudit({
        userId: identity.userId,
        personalId: identity.tenantId,
        action: 'READ',
        resource: 'reports.performance',
        purpose: 'gestao_operacional',
        ip: req.ip,
      });
      return res.status(200).json({ data: report });
    } catch (error) {
      return handleReportsError(error, res, next);
    }
  });

  return router;
}

export const performanceReportsRouter = createPerformanceReportsRouter();
