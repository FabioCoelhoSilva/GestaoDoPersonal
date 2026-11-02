import type { JWTVerifyGetKey } from 'jose' with { 'resolution-mode': 'import' };
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuthContext } from './auth-context';
import { findPersonalAuthContextByProviderSub } from '../db/scoped-prisma';

type AuthIdentity = {
  userId: string;
  role: AuthContext['role'];
  tenantId: string | null;
};

type MiddlewareOptions = {
  keyResolver?: JWTVerifyGetKey;
  issuer?: string;
  lookupIdentity?: (providerSub: string) => Promise<AuthIdentity | null>;
};

export class SupabaseAuthConfigurationError extends Error {}

function requiredSupabaseUrl(value: string | undefined, variable: string) {
  if (!value) throw new SupabaseAuthConfigurationError(`${variable} não configurada`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SupabaseAuthConfigurationError(`${variable} inválida`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new SupabaseAuthConfigurationError(`${variable} deve ser uma URL HTTPS sem credenciais`);
  }
  return url;
}

function getDefaultVerifier() {
  const projectUrl = requiredSupabaseUrl(process.env.SUPABASE_URL, 'SUPABASE_URL');
  const jwksUrl = process.env.SUPABASE_JWKS_URL
    ? requiredSupabaseUrl(process.env.SUPABASE_JWKS_URL, 'SUPABASE_JWKS_URL')
    : new URL('/auth/v1/.well-known/jwks.json', projectUrl);
  const issuer = new URL('/auth/v1', projectUrl).toString().replace(/\/$/, '');
  return { jwksUrl, issuer };
}

export function createSupabaseAuthMiddleware(options: MiddlewareOptions = {}): RequestHandler {
  let keyResolver = options.keyResolver;
  let issuer = options.issuer;
  let joseModule: typeof import('jose', { with: { 'resolution-mode': 'import' } }) | undefined;

  return async (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? authorization.match(/^Bearer ([^\s]+)$/i)
        : null;
    if (!match) return res.status(401).json({ error: 'Envie Authorization: Bearer <access_token>' });

    try {
      joseModule ??= await import('jose');
      if (!keyResolver || !issuer) {
        const verifier = getDefaultVerifier();
        keyResolver ??= joseModule.createRemoteJWKSet(verifier.jwksUrl);
        issuer ??= verifier.issuer;
      }

      const { payload } = await joseModule.jwtVerify(match[1], keyResolver, {
        issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
        requiredClaims: ['sub', 'exp'],
      });

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        return res.status(401).json({ error: 'Token de acesso inválido' });
      }

      const identity = await (options.lookupIdentity ?? findPersonalAuthContextByProviderSub)(payload.sub);
      if (!identity || identity.role !== 'PERSONAL' || !identity.tenantId) {
        return res.status(403).json({ error: 'Utilizador sem tenant de personal ativo' });
      }

      const auth: AuthContext = {
        userId: identity.userId,
        subject: payload.sub,
        role: identity.role,
        tenantId: identity.tenantId,
        personalId: identity.tenantId,
      };
      req.auth = auth;
      req.tenantId = auth.tenantId ?? undefined;
      return next();
    } catch (error) {
      if (error instanceof SupabaseAuthConfigurationError) {
        return res.status(503).json({ error: 'Autenticação Supabase não configurada corretamente' });
      }
      if (joseModule && error instanceof joseModule.errors.JWKSTimeout) {
        return res.status(503).json({ error: 'Serviço de chaves de autenticação temporariamente indisponível' });
      }
      if (joseModule && error instanceof joseModule.errors.JOSEError) {
        return res.status(401).json({ error: 'Token de acesso inválido ou expirado' });
      }
      return next(error);
    }
  };
}

export const supabaseAuthMiddleware = createSupabaseAuthMiddleware();
