import { NextFunction, Request, Response, RequestHandler } from 'express';
import { AuthContext } from '../auth/auth-context';
import { assertSubscriptionAccess, BillingAccessDeniedError } from './subscription.service';

type AuthenticatedRequest = Request & {
  auth?: AuthContext;
  tenantId?: string;
};

export function createSubscriptionAccessMiddleware(
  checkAccess: typeof assertSubscriptionAccess = assertSubscriptionAccess,
): RequestHandler {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Autenticação obrigatória' });
    }
    if (
      typeof req.tenantId !== 'string' ||
      req.tenantId.length === 0 ||
      req.auth.tenantId !== req.tenantId
    ) {
      return res.status(403).json({ error: 'Tenant autenticado inválido' });
    }

    try {
      await checkAccess(req.tenantId);
      return next();
    } catch (error) {
      if (error instanceof BillingAccessDeniedError) {
        return res.status(402).json({
          error: error.message,
          code: error.code,
        });
      }
      return next(error);
    }
  };
}

export const subscriptionAccessMiddleware = createSubscriptionAccessMiddleware();
