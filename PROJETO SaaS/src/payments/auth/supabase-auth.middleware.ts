import { Request, Response, NextFunction } from 'express';

export async function supabaseAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized payment session.' });
  }
}

export function createSupabaseAuthMiddleware(options?: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized payment session.' });
    }
  };
}
