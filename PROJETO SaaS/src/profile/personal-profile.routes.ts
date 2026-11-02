import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AuthContext } from '../auth/auth-context';
import { logAccess } from '../db/scoped-prisma';
import {
  PersonalProfileNotFoundError,
  PersonalProfileService,
  PersonalProfileValidationError,
} from './personal-profile.service';

type AuthenticatedRequest = Request & {
  auth?: AuthContext;
  tenantId?: string;
};

export type PersonalProfileReader = {
  getProfile: (userId: string, tenantId: string) => Promise<unknown>;
  updateProfile: (
    userId: string,
    tenantId: string,
    input: { name: string },
  ) => Promise<unknown>;
};

const profileNameSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
});

function requirePersonal(req: AuthenticatedRequest, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: 'Autenticação obrigatória' });
    return null;
  }
  if (req.auth.role !== 'PERSONAL') {
    res.status(403).json({ error: 'Acesso restrito a personal autenticado' });
    return null;
  }
  if (
    !req.auth.userId ||
    !req.auth.tenantId ||
    typeof req.tenantId !== 'string' ||
    req.tenantId !== req.auth.tenantId
  ) {
    res.status(403).json({ error: 'Identidade ou tenant autenticado inválido' });
    return null;
  }
  return { userId: req.auth.userId, tenantId: req.auth.tenantId };
}

function handleProfileError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof PersonalProfileValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof PersonalProfileNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  return next(error);
}

export function createPersonalProfileRouter(
  service: PersonalProfileReader = new PersonalProfileService(),
  writeAudit: typeof logAccess = logAccess,
) {
  const router = Router();

  router.get('/me', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = requirePersonal(req, res);
    if (!identity) return;

    try {
      const profile = await service.getProfile(identity.userId, identity.tenantId);
      return res.status(200).json({ data: profile });
    } catch (error) {
      return handleProfileError(error, res, next);
    }
  });

  router.patch('/me', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = requirePersonal(req, res);
    if (!identity) return;

    const parsed = profileNameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados do perfil inválidos',
        detalhes: parsed.error.flatten(),
      });
    }

    try {
      const profile = await service.updateProfile(
        identity.userId,
        identity.tenantId,
        parsed.data,
      );
      await writeAudit({
        userId: identity.userId,
        personalId: identity.tenantId,
        action: 'WRITE',
        resource: 'personal.profile',
        resourceId: identity.tenantId,
        purpose: 'gestao_operacional',
        ip: req.ip,
      });
      return res.status(200).json({ data: profile });
    } catch (error) {
      return handleProfileError(error, res, next);
    }
  });

  return router;
}

export const personalProfileRouter = createPersonalProfileRouter();
