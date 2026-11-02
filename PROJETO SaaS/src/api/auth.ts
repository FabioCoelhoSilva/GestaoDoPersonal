import { createClient } from '@supabase/supabase-js';
import type { Request, RequestHandler } from 'express';
import { findUserBySupabaseId } from '../db/scoped-prisma';

export type AuthContext = {
  userId: string;
  personalId: string;
  role: 'PERSONAL';
  name: string;
  email: string;
};

export type AuthenticatedRequest = Request & { auth?: AuthContext };

type LinkedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  personal: { id: string } | null;
};

export function createAuthMiddleware(
  getUser: (accessToken: string) => Promise<{ id: string } | null>,
  findUser: (supabaseUserId: string) => Promise<LinkedUser | null> = findUserBySupabaseId,
): RequestHandler {
  return async (req, res, next) => {
    const authorization = req.header('authorization');
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Faça login para continuar.' });
      return;
    }

    try {
      const supabaseUser = await getUser(match[1]);
      if (!supabaseUser) {
        res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
        return;
      }

      const user = await findUser(supabaseUser.id);
      if (!user || user.role !== 'PERSONAL' || !user.personal) {
        res.status(403).json({
          error: 'Esta conta ainda não está vinculada a um cadastro de personal.',
        });
        return;
      }

      (req as AuthenticatedRequest).auth = {
        userId: user.id,
        personalId: user.personal.id,
        role: 'PERSONAL',
        name: user.name,
        email: user.email,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createSupabaseAuthMiddleware() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no ambiente do servidor.');
  }

  const supabase = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return createAuthMiddleware(async (accessToken) => {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error) {
      if (error.status && error.status < 500) return null;
      throw error;
    }
    return data.user ? { id: data.user.id } : null;
  });
}
