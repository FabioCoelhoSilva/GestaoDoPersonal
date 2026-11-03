import express, { RequestHandler } from 'express';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSubscriptionRouter } from '../src/billing/subscription.routes';
import {
  BillingAccessDeniedError,
  BillingOverview,
} from '../src/billing/subscription.service';
import { createSubscriptionAccessMiddleware } from '../src/billing/subscription.middleware';
import { StripeBillingActions } from '../src/billing/subscription.routes';

const overview: BillingOverview = {
  subscription: {
    status: 'ACTIVE',
    currentPeriodEnd: new Date('2027-01-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    stripeCustomerLinked: true,
  },
  plan: { name: 'Pro', maxStudents: 20, maxWorkouts: 50 },
  usage: { activeStudents: 2, activeWorkouts: 4 },
  accessAllowed: true,
};

let role: 'PERSONAL' | 'STUDENT' | null;
let authTenantId: string | null;
let requestTenantId: string | undefined;
let server: Server;
let baseUrl: string;

const readOverview = vi.fn(async () => overview);
const writeAudit = vi.fn(async () => undefined);
const checkAccess = vi.fn(async () => overview);
const stripeActions: StripeBillingActions = {
  listPlans: vi.fn(async () => [{ id: 'plan-1', name: 'Pro' }]),
  listInvoices: vi.fn(async () => []),
  createPortal: vi.fn(async () => ({ url: 'https://billing.stripe.com/session/test' })),
  createCheckout: vi.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/test' })),
};

const authMiddleware: RequestHandler = (req, _res, next) => {
  req.tenantId = requestTenantId;
  if (role) {
    req.auth = {
      userId: 'user-1',
      subject: 'subject-1',
      role,
      tenantId: authTenantId,
      personalId: authTenantId,
      studentId: role === 'STUDENT' ? 'student-1' : null,
    };
  }
  next();
};

beforeEach(async () => {
  role = 'PERSONAL';
  authTenantId = 'tenant-1';
  requestTenantId = 'tenant-1';
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use('/api', authMiddleware);
  app.use(
    '/api/billing',
    createSubscriptionRouter({ getOverview: readOverview }, writeAudit, stripeActions),
  );
  app.get('/api/protected', createSubscriptionAccessMiddleware(checkAccess), (_req, res) => {
    res.status(200).json({ ok: true });
  });
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

describe('billing subscription HTTP routes', () => {
  it('exposes subscription status and plan usage only to the tenant personal', async () => {
    const response = await fetch(`${baseUrl}/api/billing/me`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        ...overview,
        subscription: {
          ...overview.subscription,
          currentPeriodEnd: overview.subscription?.currentPeriodEnd?.toISOString(),
        },
      },
    });
    expect(readOverview).toHaveBeenCalledWith('tenant-1');
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      personalId: 'tenant-1',
      resource: 'billing.subscription',
    }));
  });

  it('rejects unauthenticated, student, mismatched tenant, and caller-supplied tenant filters', async () => {
    role = null;
    expect((await fetch(`${baseUrl}/api/billing/me`)).status).toBe(401);

    role = 'STUDENT';
    expect((await fetch(`${baseUrl}/api/billing/me`)).status).toBe(403);

    role = 'PERSONAL';
    authTenantId = 'tenant-other';
    expect((await fetch(`${baseUrl}/api/billing/me`)).status).toBe(403);

    authTenantId = 'tenant-1';
    expect((await fetch(`${baseUrl}/api/billing/me?tenantId=tenant-other`)).status).toBe(400);
    expect(readOverview).not.toHaveBeenCalled();
  });

  it('blocks protected API access when the subscription is inactive', async () => {
    checkAccess.mockRejectedValueOnce(
      new BillingAccessDeniedError('SUBSCRIPTION_INACTIVE', 'Subscrição inativa'),
    );
    const response = await fetch(`${baseUrl}/api/protected`);
    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      code: 'SUBSCRIPTION_INACTIVE',
    });
  });

  it('serves billing plans and Stripe invoices only for authenticated personals', async () => {
    const [plans, invoices] = await Promise.all([
      fetch(`${baseUrl}/api/billing/plans`),
      fetch(`${baseUrl}/api/billing/invoices`),
    ]);
    expect(plans.status).toBe(200);
    await expect(plans.json()).resolves.toEqual({ data: [{ id: 'plan-1', name: 'Pro' }] });
    expect(invoices.status).toBe(200);
    await expect(invoices.json()).resolves.toEqual({ data: [] });
    expect(stripeActions.listInvoices).toHaveBeenCalledWith('tenant-1');

    role = 'STUDENT';
    expect((await fetch(`${baseUrl}/api/billing/invoices`)).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/billing/plans`)).status).toBe(403);
  });

  it('creates tenant-bound checkout and portal sessions without accepting redirect URLs', async () => {
    const checkout = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan-1' }),
    });
    expect(checkout.status).toBe(200);
    await expect(checkout.json()).resolves.toEqual({
      data: { url: 'https://checkout.stripe.com/c/pay/test' },
    });
    expect(stripeActions.createCheckout).toHaveBeenCalledWith('tenant-1', 'plan-1');

    const portal = await fetch(`${baseUrl}/api/billing/portal`, { method: 'POST' });
    expect(portal.status).toBe(200);
    expect(stripeActions.createPortal).toHaveBeenCalledWith('tenant-1');

    const injectedReturnUrl = await fetch(`${baseUrl}/api/billing/portal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'https://attacker.example' }),
    });
    expect(injectedReturnUrl.status).toBe(400);

    const invalidPlan = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan-1', tenantId: 'tenant-other' }),
    });
    expect(invalidPlan.status).toBe(400);
  });

  it('rejects requests whose tenant does not match the authenticated context', async () => {
    requestTenantId = 'tenant-other';
    const response = await fetch(`${baseUrl}/api/protected`);
    expect(response.status).toBe(403);
    expect(checkAccess).not.toHaveBeenCalled();
  });
});
