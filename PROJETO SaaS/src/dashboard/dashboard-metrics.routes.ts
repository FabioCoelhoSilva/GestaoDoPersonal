import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AuthContext } from '../auth/auth-context';
import { DashboardMetrics, DashboardMetricsService } from './dashboard-metrics.service';

type AuthenticatedRequest = Request & {
  auth?: AuthContext;
  tenantId?: string;
};

export type DashboardMetricsReader = {
  summary: () => Promise<DashboardMetrics>;
};

const emptyQuerySchema = z.strictObject({});

function requirePersonalTenant(req: AuthenticatedRequest, res: Response) {
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
    res.status(403).json({ error: 'Tenant autenticado não corresponde ao contexto da requisição' });
    return null;
  }
  return req.tenantId;
}

export function createDashboardMetricsRouter(
  createReader: (tenantId: string) => DashboardMetricsReader =
    (tenantId) => new DashboardMetricsService(tenantId),
) {
  const router = Router();

  router.get('/metrics', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const tenantId = requirePersonalTenant(req, res);
    if (!tenantId) return;

    const parsedQuery = emptyQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        error: 'Parâmetros inválidos',
        detalhes: parsedQuery.error.flatten(),
      });
    }

    try {
      const metrics = await createReader(tenantId).summary();
      return res.status(200).json({ data: metrics });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export const dashboardMetricsRouter = createDashboardMetricsRouter();
