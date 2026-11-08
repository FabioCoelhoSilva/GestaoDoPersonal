import { Request, Response, NextFunction } from 'express';

export function apiErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
}
