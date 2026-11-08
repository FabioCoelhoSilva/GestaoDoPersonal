import { Router } from 'express';

export const paymentRouter = Router();

paymentRouter.get('/', (req, res) => {
  res.json({ status: 'Payment routes active' });
});
