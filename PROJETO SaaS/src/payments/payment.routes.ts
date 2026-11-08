import { Router } from 'express';
import { supabaseAuthMiddleware } from './auth/supabase-auth.middleware';
import { subscriptionAccessMiddleware } from './billing/subscription.middleware';
import { apiErrorHandler } from './middleware/api-error-handler';
import { stripeWebhookHandler } from './webhooks/stripe.routes';
import { appointmentRouter } from './appointments/appointment.routes';
import studentRoutes from './students/student.routes';
import workoutRoutes from './workouts/workout.routes';
import dashboardRoutes from './dashboard/dashboard.routes';
import personalProfileRoutes from './profile/personal-profile.routes';

export const paymentRouter = Router();

paymentRouter.use(supabaseAuthMiddleware);

paymentRouter.get('/', (req, res) => {
  res.json({ status: 'Main payments router active' });
});

paymentRouter.use('/dashboard', dashboardRoutes);
paymentRouter.use('/students', studentRoutes);
paymentRouter.use('/workouts', workoutRoutes);
paymentRouter.use('/appointments', appointmentRouter);
paymentRouter.use('/profile', personalProfileRoutes);
paymentRouter.use('/billing', subscriptionAccessMiddleware);
paymentRouter.use('/webhook', stripeWebhookHandler);

paymentRouter.use(apiErrorHandler);
