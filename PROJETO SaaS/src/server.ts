import 'dotenv/config';
import express, { ErrorRequestHandler, RequestHandler } from 'express';
import { supabaseAuthMiddleware } from './auth/supabase-auth.middleware';
import { dashboardRouter } from './dashboard/dashboard.routes';
import { stripeWebhookHandler } from './webhooks/stripe.routes';

export function createApp(authMiddleware: RequestHandler = supabaseAuthMiddleware) {
  const app = express();

  app.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '1mb' }),
    (req, res, next) => stripeWebhookHandler(req, res, next),
  );

  app.use(express.json({ limit: '1mb' }));

  app.use('/api/dashboard', authMiddleware);
  app.use('/api/dashboard', dashboardRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof error.status === 'number' &&
      error.status >= 400 &&
      error.status < 500
        ? error.status
        : 500;

    if (status >= 500) console.error('Erro não tratado na API', error);
    res.status(status).json({
      error: status === 400 ? 'Pedido inválido' : 'Erro interno do servidor',
    });
  };
  app.use(errorHandler);

  return app;
}

export function startServer() {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um número entre 1 e 65535');
  }

  return createApp().listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
  });
}

if (require.main === module) startServer();
