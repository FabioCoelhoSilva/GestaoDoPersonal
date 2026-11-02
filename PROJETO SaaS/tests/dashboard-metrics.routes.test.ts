import express, { RequestHandler } from 'express';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDashboardMetricsRouter,
  DashboardMetricsReader,
} from '../src/dashboard/dashboard-metrics.routes';
import { DashboardMetrics } from '../src/dashboard/dashboard-metrics.service';

const metrics: DashboardMetrics = {
  activeStudents: 7,
  workoutPlans: 12,
  sessions: { executed: 9, inProgress: 2, total: 11 },
};
const summary = vi.fn<DashboardMetricsReader['summary']>(async () => metrics);
let role: 'PERSONAL' | 'STUDENT' | null = 'PERSONAL';
let tenantId: string | undefined = 'tenant-1';
let authTenantId: string | null = 'tenant-1';
let server: Server;
let baseUrl: string;

const authMiddleware: RequestHandler = (req, _res, next) => {
  if (role) {
    req.auth = {
      userId: 'user-1',
      subject: 'subject-1',
      role,
      tenantId: authTenantId ?? null,
      personalId: authTenantId ?? null,
      studentId: role === 'STUDENT' ? 'student-1' : null,
    };
  }
  req.tenantId = tenantId;
  next();
};

beforeEach(async () => {
  role = 'PERSONAL';
  tenantId = 'tenant-1';
  authTenantId = 'tenant-1';
  vi.clearAllMocks();
  const app = express();
  app.use('/api/dashboard', authMiddleware, createDashboardMetricsRouter(() => ({ summary })));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Erro interno do servidor' });
  });
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('GET /api/dashboard/metrics', () => {
  it('returns tenant dashboard aggregates for an authenticated personal', async () => {
    const response = await fetch(`${baseUrl}/api/dashboard/metrics`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: metrics });
    expect(summary).toHaveBeenCalledOnce();
  });

  it('rejects unauthenticated and non-personal callers', async () => {
    role = 'STUDENT';
    const studentResponse = await fetch(`${baseUrl}/api/dashboard/metrics`);
    expect(studentResponse.status).toBe(403);
    expect(summary).not.toHaveBeenCalled();

    role = 'PERSONAL';
    authTenantId = 'tenant-other';
    const mismatchedResponse = await fetch(`${baseUrl}/api/dashboard/metrics`);
    expect(mismatchedResponse.status).toBe(403);
    expect(summary).not.toHaveBeenCalled();

    role = null;
    const unauthenticatedResponse = await fetch(`${baseUrl}/api/dashboard/metrics`);
    expect(unauthenticatedResponse.status).toBe(401);
    expect(summary).not.toHaveBeenCalled();
  });

  it('rejects query parameters instead of accepting arbitrary metric filters', async () => {
    const response = await fetch(`${baseUrl}/api/dashboard/metrics?tenantId=tenant-other`);

    expect(response.status).toBe(400);
    expect(summary).not.toHaveBeenCalled();
  });

  it('forwards service failures to the error handler', async () => {
    summary.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await fetch(`${baseUrl}/api/dashboard/metrics`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Erro interno do servidor' });
  });
});
