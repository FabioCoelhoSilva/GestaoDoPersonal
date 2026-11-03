import 'dotenv/config';
import express, { RequestHandler } from 'express';
import {
  createSupabaseAuthMiddleware,
  supabaseAuthMiddleware,
} from './auth/supabase-auth.middleware';
import { dashboardRouter } from './dashboard/dashboard.routes';
import { studentWorkoutRouter } from './students/student-workout.routes';
import { workoutExecutionRouter } from './students/workout-execution.routes';
import { personalProfileRouter } from './profile/personal-profile.routes';
import { stripeWebhookHandler } from './webhooks/stripe.routes';
import { subscriptionRouter } from './billing/subscription.routes';
import { subscriptionAccessMiddleware } from './billing/subscription.middleware';
import { apiErrorHandler } from './middleware/api-error-handler';
import { onboardingRouter } from './onboarding/onboarding.routes';
import { paymentRouter } from './payments/payment.routes';
import { appointmentRouter } from './appointments/appointment.routes';
import { performanceReportsRouter } from './reports/performance-reports.routes';

const onboardingAuthMiddleware = createSupabaseAuthMiddleware({ allowUnprovisioned: true });

export function createApp(
  authMiddleware: RequestHandler = supabaseAuthMiddleware,
  provisionAuthMiddleware: RequestHandler = onboardingAuthMiddleware,
) {
  const app = express();
  const personalOnly: RequestHandler = (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Autenticação obrigatória' });
    if (req.auth.role !== 'PERSONAL') {
      return res.status(403).json({ error: 'Acesso restrito a personal autenticado' });
    }
    return next();
  };

  app.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '1mb' }),
    (req, res, next) => stripeWebhookHandler(req, res, next),
  );

  app.use(express.json({ limit: '1mb' }));

  app.use('/api/onboarding', provisionAuthMiddleware, onboardingRouter);
  app.use('/api', authMiddleware);
  app.use('/api/billing', subscriptionRouter);
  app.use(
    [
      '/api/students',
      '/api/workouts',
      '/api/workout-exercises',
      '/api/workout-executions',
      '/api/payments',
      '/api/appointments',
      '/api/reports',
    ],
    subscriptionAccessMiddleware,
  );
  app.use('/api/dashboard', personalOnly, subscriptionAccessMiddleware, dashboardRouter);
  app.use('/api', studentWorkoutRouter);
  app.use('/api', workoutExecutionRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/appointments', appointmentRouter);
  app.use('/api/reports', performanceReportsRouter);
  app.use('/api/profile', personalProfileRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  app.use(apiErrorHandler);

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
