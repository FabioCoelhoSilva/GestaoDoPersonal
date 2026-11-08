import { Router, Request, Response } from 'express';

export const stripeWebhookRouter = Router();

export async function stripeWebhookHandler(req: Request, res: Response) {
  return res.json({ status: 'Webhook handled successfully' });
}

stripeWebhookRouter.post('/', stripeWebhookHandler);
