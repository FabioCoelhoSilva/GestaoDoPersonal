import { Router } from 'express';
export const onboardingRouter = Router();
onboardingRouter.get('/', (req, res) => res.json({ status: 'ok' }));
