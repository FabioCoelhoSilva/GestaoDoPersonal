import { NextFunction, Request, Response, Router } from 'express';
import { AuthContext } from '../auth/auth-context';
import { logAccess } from '../db/scoped-prisma';
import { BillingOverview, getBillingOverview } from './subscription.service';

type AuthenticatedRequest = Request & {
  auth?: AuthContext;
  tenantId?: string;
};

export type BillingReader = {
  getOverview: (tenantId: string) => Promise<BillingOverview>;
};

function requirePersonal(req: AuthenticatedRequest, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: 'Autenticação obrigatória' });
    return null;
  }
  if (req.auth.role !== 'PERSONAL') {
    res.status(403).json({ error: 'Acesso restrito ao personal do tenant' });
    return null;
  }
  if (
    !req.auth.tenantId ||
    typeof req.tenantId !== 'string' ||
    req.tenantId !== req.auth.tenantId
  ) {
    res.status(403).json({ error: 'Tenant autenticado inválido' });
    return null;
  }
  return { userId: req.auth.userId, tenantId: req.auth.tenantId };
}

export function createSubscriptionRouter(
  reader: BillingReader = { getOverview: getBillingOverview },
  writeAudit: typeof logAccess = logAccess,
) {
  const router = Router();

  router.get('/me', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = requirePersonal(req, res);
    if (!identity) return;
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({ error: 'Esta rota não aceita parâmetros de consulta' });
    }

    try {
      const overview = await reader.getOverview(identity.tenantId);
      await writeAudit({
        userId: identity.userId,
        personalId: identity.tenantId,
        action: 'READ',
        resource: 'billing.subscription',
        purpose: 'gestao_financeira',
        ip: req.ip,
      });
      return res.status(200).json({ data: overview });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export const subscriptionRouter = createSubscriptionRouter();
