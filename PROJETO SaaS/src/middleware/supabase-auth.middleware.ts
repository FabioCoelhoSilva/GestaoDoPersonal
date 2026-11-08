import { Request, Response, NextFunction } from 'express';

export async function supabaseAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized or invalid token.' });
  }
}

export async function requirePersonal(req: Request, res: Response, next: NextFunction) {
  try {
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Personal access required.' });
  }
}
