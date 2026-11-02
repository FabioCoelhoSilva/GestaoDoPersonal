import { BillingStatus, PrismaClient } from '@prisma/client';
import type { JWTVerifyGetKey } from 'jose' with { 'resolution-mode': 'import' };
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSupabaseAuthMiddleware } from '../src/auth/supabase-auth.middleware';
import { createApp } from '../src/server';

const { assertSafeTestDatabaseEnv } = require('../scripts/test-db-safety.cjs') as {
  assertSafeTestDatabaseEnv: (env: NodeJS.ProcessEnv) => string;
};
const testDatabaseUrl = assertSafeTestDatabaseEnv(process.env);
const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
const issuer = 'https://onboarding-e2e.supabase.co/auth/v1';
const suffix = crypto.randomUUID();
const email = `onboarding-${suffix}@test.invalid`;
const providerSub = `supabase-onboarding-${suffix}`;
const previousPlanId = process.env.ONBOARDING_TRIAL_PLAN_ID;
const previousTrialDays = process.env.ONBOARDING_TRIAL_DAYS;

let server: Server | undefined;
let baseUrl: string;
let planId: string;
let token: string;
let missingPlanToken: string;

beforeAll(async () => {
  const { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const publicJwk = await exportJWK(publicKey);
  const keyResolver: JWTVerifyGetKey = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: 'onboarding-e2e', alg: 'ES256', use: 'sig' }],
  });

  const plan = await prisma.plan.create({
    data: {
      name: `Onboarding E2E ${suffix}`,
      stripePriceId: `price_onboarding_${suffix}`,
      maxStudents: 5,
      maxWorkouts: 5,
    },
  });
  planId = plan.id;
  process.env.ONBOARDING_TRIAL_PLAN_ID = plan.id;
  process.env.ONBOARDING_TRIAL_DAYS = '14';

  const signToken = (subject: string, tokenEmail: string) =>
    new SignJWT({ role: 'authenticated', email: tokenEmail })
      .setProtectedHeader({ alg: 'ES256', kid: 'onboarding-e2e' })
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  token = await signToken(providerSub, email);
  missingPlanToken = await signToken(`unconfigured-${suffix}`, `unconfigured-${suffix}@test.invalid`);
  const regularAuth = createSupabaseAuthMiddleware({ keyResolver, issuer });
  const onboardingAuth = createSupabaseAuthMiddleware({
    keyResolver,
    issuer,
    allowUnprovisioned: true,
  });
  server = createApp(regularAuth, onboardingAuth).listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor E2E sem porta TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  try {
    const user = await prisma.user.findUnique({
      where: { providerSub },
      include: { personal: true },
    });
    if (user?.personal) {
      await prisma.billingSubscription.deleteMany({ where: { personalId: user.personal.id } });
      await prisma.personal.deleteMany({ where: { id: user.personal.id } });
    }
    if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    if (planId) await prisma.plan.deleteMany({ where: { id: planId } });
  } finally {
    if (previousPlanId === undefined) delete process.env.ONBOARDING_TRIAL_PLAN_ID;
    else process.env.ONBOARDING_TRIAL_PLAN_ID = previousPlanId;
    if (previousTrialDays === undefined) delete process.env.ONBOARDING_TRIAL_DAYS;
    else process.env.ONBOARDING_TRIAL_DAYS = previousTrialDays;

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await prisma.$disconnect();
  }
});

describe('personal onboarding E2E', () => {
  it('provisions an authenticated Supabase identity once and grants trial access', async () => {
    const unauthorized = await fetch(`${baseUrl}/api/onboarding/provision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(unauthorized.status).toBe(401);

    const mismatch = await fetch(`${baseUrl}/api/onboarding/provision`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: `other-${suffix}@test.invalid` }),
    });
    expect(mismatch.status).toBe(403);

    const provision = () =>
      fetch(`${baseUrl}/api/onboarding/provision`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
    const concurrentResponses = await Promise.all([provision(), provision()]);
    const concurrentPayloads = await Promise.all(concurrentResponses.map((response) => response.json()));
    expect(concurrentResponses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(concurrentPayloads.map((payload) => payload.data.created).sort()).toEqual([false, true]);
    const tenantId = concurrentPayloads[0].data.tenantId;
    expect(concurrentPayloads[1].data.tenantId).toBe(tenantId);

    const user = await prisma.user.findUniqueOrThrow({
      where: { providerSub },
      include: { personal: { include: { billingSubscription: true } } },
    });
    expect(user.email).toBe(email);
    expect(user.role).toBe('PERSONAL');
    expect(user.personal?.id).toBe(tenantId);
    expect(user.personal?.billingSubscription).toMatchObject({
      planId,
      status: BillingStatus.TRIALING,
    });
    expect(user.personal?.billingSubscription?.currentPeriodEnd?.getTime()).toBeGreaterThan(Date.now());

    const repeated = await fetch(`${baseUrl}/api/onboarding/provision`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    expect(repeated.status).toBe(200);
    await expect(repeated.json()).resolves.toMatchObject({
      data: { created: false, tenantId: user.personal?.id },
    });
    expect(await prisma.billingSubscription.count({ where: { personalId: user.personal!.id } })).toBe(1);

    const dashboard = await fetch(`${baseUrl}/api/dashboard/metrics`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(dashboard.status).toBe(200);
  });

  it('fails closed without trial plan configuration and creates no account', async () => {
    const originalPlanId = process.env.ONBOARDING_TRIAL_PLAN_ID;
    delete process.env.ONBOARDING_TRIAL_PLAN_ID;
    try {
      const response = await fetch(`${baseUrl}/api/onboarding/provision`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${missingPlanToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email: `unconfigured-${suffix}@test.invalid` }),
      });
      expect(response.status).toBe(503);
      expect(
        await prisma.user.findUnique({ where: { providerSub: `unconfigured-${suffix}` } }),
      ).toBeNull();
    } finally {
      if (originalPlanId) process.env.ONBOARDING_TRIAL_PLAN_ID = originalPlanId;
    }
  });
});
