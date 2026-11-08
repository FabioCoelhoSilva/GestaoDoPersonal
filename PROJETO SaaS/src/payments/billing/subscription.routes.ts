import { Router } from 'express';
export const subscriptionRouter = Router();
subscriptionRouter.get('/', (req, res) => res.json({ status: 'ok' }));
