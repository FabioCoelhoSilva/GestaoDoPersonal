import { Router } from 'express';
export const workoutExecutionRouter = Router();
workoutExecutionRouter.get('/', (req, res) => res.json({ status: 'ok' }));
