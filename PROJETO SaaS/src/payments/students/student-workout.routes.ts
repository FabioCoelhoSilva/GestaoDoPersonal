import { Router } from 'express';
export const studentWorkoutRouter = Router();
studentWorkoutRouter.get('/', (req, res) => res.json({ status: 'ok' }));
