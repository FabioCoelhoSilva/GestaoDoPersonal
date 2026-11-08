import { Router } from 'express';
export const performanceReportsRouter = Router();
performanceReportsRouter.get('/', (req, res) => res.json({ status: 'ok' }));
