import { Request, Response, NextFunction } from 'express';

export async function subscriptionMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Subscription check failed.' });
  }
}

export async function subscriptionAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Subscription access check failed.' });
  }
}
