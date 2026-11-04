import { Router } from 'express';
import { requirePersonal } from '../middleware/supabase-auth.middleware';
import { createDashboardMetricsRouter } from './dashboard-metrics.routes';

export const dashboardRouter = Router();

dashboardRouter.use(requirePersonal);
dashboardRouter.use('/', createDashboardMetricsRouter());
