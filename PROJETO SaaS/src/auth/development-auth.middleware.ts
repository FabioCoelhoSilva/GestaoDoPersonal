import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuthContext } from './auth-context';
import { findPersonalAuthContextById } from '../db/scoped-prisma';

type PersonalLookup = (personalId: string) => Promise<{ id: string; userId: string } | null>;

function tokenMatches(provided: string, expected: string) {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export function createDevelopmentAuthMiddleware(
  lookupPersonal: PersonalLookup = findPersonalAuthContextById,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Middleware de autenticação de produção não configurado' });
    }

    const expectedToken = process.env.DEV_AUTH_TOKEN?.trim();
    const personalId = process.env.DEV_PERSONAL_ID?.trim();
    if (!expectedToken || expectedToken.length < 32 || !personalId) {
      return res.status(503).json({
        error: 'Configure DEV_PERSONAL_ID e um DEV_AUTH_TOKEN com pelo menos 32 caracteres',
      });
    }

    const authorization = req.headers.authorization;
    const match = typeof authorization === 'string'
      ? authorization.match(/^Bearer ([^\s]+)$/i)
      : null;
    if (!match) {
      return res.status(401).json({ error: 'Envie Authorization: Bearer <token>' });
    }
    if (!tokenMatches(match[1], expectedToken)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    try {
      const personal = await lookupPersonal(personalId);
      if (!personal) {
        return res.status(403).json({ error: 'DEV_PERSONAL_ID não corresponde a um personal existente' });
      }

      const auth: AuthContext = {
        userId: personal.userId,
        subject: personal.userId,
        role: 'PERSONAL',
        tenantId: personal.id,
        personalId: personal.id,
      };
      req.auth = auth;
      req.tenantId = personal.id;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const developmentAuthMiddleware = createDevelopmentAuthMiddleware();
