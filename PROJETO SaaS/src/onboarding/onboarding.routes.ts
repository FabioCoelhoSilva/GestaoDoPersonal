import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AuthContext } from '../auth/auth-context';
import {
  PersonalProvisioningConflictError,
  PersonalProvisioningPlanUnavailableError,
} from '../db/scoped-prisma';
import { OnboardingConfigurationError, OnboardingService } from './onboarding.service';

type AuthenticatedRequest = Request & { auth?: AuthContext };

const provisionSchema = z.strictObject({
  email: z.string().trim().email().max(254),
});

export function createOnboardingRouter(service = new OnboardingService()) {
  const router = Router();

  router.post('/provision', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth || auth.role !== 'PERSONAL' || !auth.subject || !auth.email) {
      return res.status(401).json({ error: 'É necessária uma sessão Supabase válida com email' });
    }

    const parsed = provisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados de provisionamento inválidos',
        detalhes: parsed.error.flatten(),
      });
    }
    if (parsed.data.email.toLowerCase() !== auth.email.toLowerCase()) {
      return res.status(403).json({ error: 'O email não corresponde à identidade autenticada' });
    }

    try {
      const result = await service.provision({
        providerSub: auth.subject,
        email: auth.email,
      });
      return res.status(result.created ? 201 : 200).json({
        data: {
          userId: result.userId,
          tenantId: result.personalId,
          created: result.created,
        },
      });
    } catch (error) {
      if (error instanceof PersonalProvisioningConflictError) {
        return res.status(409).json({ error: error.message, code: 'IDENTITY_ALREADY_LINKED' });
      }
      if (
        error instanceof PersonalProvisioningPlanUnavailableError ||
        error instanceof OnboardingConfigurationError
      ) {
        return res.status(503).json({ error: 'O provisionamento não está configurado', code: 'ONBOARDING_UNAVAILABLE' });
      }
      return next(error);
    }
  });

  return router;
}

export const onboardingRouter = createOnboardingRouter();
