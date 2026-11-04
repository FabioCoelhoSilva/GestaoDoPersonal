import { Router, Response } from 'express';
import { AuthContext } from '../auth/auth-context';
import { DashboardMetricsService } from './dashboard-metrics.service';

export interface DashboardMetricsReader {
  summary(personalId: string): Promise<any>;
}

export function createDashboardMetricsRouter(metricsService?: DashboardMetricsReader) {
  const router = Router();

  router.get('/metrics', async (req: AuthContext, res: Response, next) => {
    try {
      if (!req.user || !req.personalId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      if (req.user.role !== 'PERSONAL') {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      if (req.query && Object.keys(req.query).length > 0) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }

      const personalId = req.personalId;
      const service = metricsService || new DashboardMetricsService(personalId);
      const metrics = await service.summary();

      return res.json({ data: metrics });
    } catch (error: any) {
      if (error.message && error.message.includes('Erro interno')) {
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
      return next(error);
    }
  });

  return router;
}
