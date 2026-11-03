import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AuthContext } from '../auth/auth-context';
import { logAccess } from '../db/scoped-prisma';
import { getBillingOverview, type BillingOverview } from './subscription.service';
import {
  createStripeCheckout,
  createStripePortal,
  listStripeInvoices,
  listStripePlanOptions,
  StripeBillingError,
  type StripeInvoiceSummary,
  type StripePlanOption,
} from './stripe-billing.service';

type AuthenticatedRequest = Request & {
  auth?: AuthContext;
  tenantId?: string;
};

export type BillingReader = {
  getOverview: (tenantId: string) => Promise<BillingOverview>;
};

export type StripeBillingActions = {
  listPlans: () => Promise<StripePlanOption[]>;
  listInvoices: (tenantId: string) => Promise<StripeInvoiceSummary[]>;
  createPortal: (tenantId: string) => Promise<{ url: string }>;
  createCheckout: (tenantId: string, planId: string) => Promise<{ url: string }>;
};

const stripeActions: StripeBillingActions = {
  listPlans: listStripePlanOptions,
  listInvoices: listStripeInvoices,
  createPortal: createStripePortal,
  createCheckout: createStripeCheckout,
};

const checkoutSchema = z.strictObject({
  planId: z.string().trim().min(1).max(64),
});

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
  stripe: StripeBillingActions = stripeActions,
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

  router.get('/plans', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = requirePersonal(req, res);
    if (!identity) return;
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({ error: 'Esta rota não aceita parâmetros de consulta' });
    }

    try {
      const plans = await stripe.listPlans();
      await writeAudit({
        userId: identity.userId,
        personalId: identity.tenantId,
        action: 'READ',
        resource: 'billing.plans',
        purpose: 'gestao_financeira',
        ip: req.ip,
      });
      return res.status(200).json({ data: plans });
    } catch (error) {
      return handleStripeBillingError(error, res, next);
    }
  });

  router.get('/invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = requirePersonal(req, res);
    if (!identity) return;
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({ error: 'Esta rota não aceita parâmetros de consulta' });
    }

    try {
      const invoices = await stripe.listInvoices(identity.tenantId);
      await writeAudit({
        userId: identity.userId,
        personalId: identity.tenantId,
        action: 'READ',
        resource: 'billing.invoices',
        purpose: 'gestao_financeira',
        ip: req.ip,
      });
      return res.status(200).json({ data: invoices });
    } catch (error) {
      return handleStripeBillingError(error, res, next);
    }
  });

  router.post('/portal', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = requirePersonal(req, res);
    if (!identity) return;
    if (Object.keys(req.body ?? {}).length > 0) {
      return res.status(400).json({ error: 'Esta rota não aceita corpo' });
    }

    try {
      const portal = await stripe.createPortal(identity.tenantId);
      await writeAudit({
        userId: identity.userId,
        personalId: identity.tenantId,
        action: 'WRITE',
        resource: 'billing.portal',
        purpose: 'gestao_financeira',
        ip: req.ip,
      });
      return res.status(200).json({ data: portal });
    } catch (error) {
      return handleStripeBillingError(error, res, next);
    }
  });

  router.post('/checkout', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = requirePersonal(req, res);
    if (!identity) return;
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Selecione um plano válido', details: parsed.error.flatten() });
    }

    try {
      const checkout = await stripe.createCheckout(identity.tenantId, parsed.data.planId);
      await writeAudit({
        userId: identity.userId,
        personalId: identity.tenantId,
        action: 'WRITE',
        resource: 'billing.checkout',
        resourceId: parsed.data.planId,
        purpose: 'gestao_financeira',
        ip: req.ip,
      });
      return res.status(200).json({ data: checkout });
    } catch (error) {
      return handleStripeBillingError(error, res, next);
    }
  });

  return router;
}

function handleStripeBillingError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof StripeBillingError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  return next(error);
}

export const subscriptionRouter = createSubscriptionRouter();
