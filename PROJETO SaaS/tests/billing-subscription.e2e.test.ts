import { createHmac } from 'node:crypto';
import { BillingStatus, PrismaClient } from '@prisma/client';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/server';
import { createWorkoutPlan } from '../src/students/student-workout.service';

const { assertSafeTestDatabaseEnv } = require('../scripts/test-db-safety.cjs') as {
  assertSafeTestDatabaseEnv: (env: NodeJS.ProcessEnv) => string;
};
const testDatabaseUrl = assertSafeTestDatabaseEnv(process.env);
const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
const suffix = crypto.randomUUID();

let server: Server;
let baseUrl: string;
let userAId: string;
let userBId: string;
let tenantAId: string;
let tenantBId: string;
let planId: string;
let studentAId: string;
const testWebhookSecret = 'whsec_billing_e2e_test_only';
const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

beforeAll(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = testWebhookSecret;
  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        email: `billing-a-${suffix}@test.invalid`,
        name: 'Billing A',
        role: 'PERSONAL',
        provider: 'GOV_BR',
      },
    }),
    prisma.user.create({
      data: {
        email: `billing-b-${suffix}@test.invalid`,
        name: 'Billing B',
        role: 'PERSONAL',
        provider: 'GOV_BR',
      },
    }),
  ]);
  userAId = userA.id;
  userBId = userB.id;
  const [tenantA, tenantB] = await Promise.all([
    prisma.personal.create({ data: { userId: userAId, name: 'Billing A' } }),
    prisma.personal.create({ data: { userId: userBId, name: 'Billing B' } }),
  ]);
  tenantAId = tenantA.id;
  tenantBId = tenantB.id;

  const plan = await prisma.plan.create({
    data: {
      name: `Billing E2E ${suffix}`,
      stripePriceId: `price_billing_${suffix}`,
      maxStudents: 1,
      maxWorkouts: 1,
    },
  });
  planId = plan.id;
  await Promise.all([
    prisma.billingSubscription.create({
      data: {
        personalId: tenantAId,
        planId,
        stripeSubscriptionId: `sub_billing_a_${suffix}`,
        stripePriceId: plan.stripePriceId,
        status: BillingStatus.ACTIVE,
      },
    }),
    prisma.billingSubscription.create({
      data: {
        personalId: tenantBId,
        planId,
        stripeSubscriptionId: `sub_billing_b_${suffix}`,
        stripePriceId: plan.stripePriceId,
        status: BillingStatus.PAST_DUE,
      },
    }),
  ]);

  const student = await prisma.student.create({
    data: {
      personalId: tenantAId,
      name: 'Existing Student',
      email: `existing-${suffix}@test.invalid`,
    },
  });
  studentAId = student.id;
  await createWorkoutPlan(tenantAId, {
    studentId: student.id,
    title: 'Existing Workout',
    exercises: [{ name: 'Squat', sets: 3, reps: '8', order: 0 }],
  });

  server = createApp((req, _res, next) => {
    const asTenantB = req.header('x-tenant') === 'b';
    const userId = asTenantB ? userBId : userAId;
    const tenantId = asTenantB ? tenantBId : tenantAId;
    req.tenantId = tenantId;
    req.auth = {
      userId,
      subject: userId,
      role: 'PERSONAL',
      tenantId,
      personalId: tenantId,
      studentId: null,
    };
    next();
  }).listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor E2E sem porta TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (tenantAId && tenantBId) {
    await prisma.workout.deleteMany({ where: { personalId: { in: [tenantAId, tenantBId] } } });
    await prisma.student.deleteMany({ where: { personalId: { in: [tenantAId, tenantBId] } } });
    await prisma.billingSubscription.deleteMany({
      where: { personalId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.stripeWebhookEvent.deleteMany({
      where: { personalId: { in: [tenantAId, tenantBId] } },
    });
    if (planId) await prisma.plan.deleteMany({ where: { id: planId } });
    await prisma.personal.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  }
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (previousWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
  await prisma.$disconnect();
});

describe('billing subscription HTTP E2E', () => {
  it('isolates access by tenant state and enforces active plan resource limits', async () => {
    const allowed = await fetch(`${baseUrl}/api/students`);
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toMatchObject({ data: [{ id: studentAId }] });

    const pastDue = await fetch(`${baseUrl}/api/students`, {
      headers: { 'x-tenant': 'b' },
    });
    expect(pastDue.status).toBe(402);
    await expect(pastDue.json()).resolves.toMatchObject({
      code: 'SUBSCRIPTION_INACTIVE',
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const event = {
      id: `evt_billing_${suffix}`,
      type: 'customer.subscription.updated',
      created: timestamp,
      data: {
        object: {
          id: `sub_billing_b_${suffix}`,
          customer: `cus_billing_${suffix}`,
          status: 'active',
          current_period_end: timestamp + 86_400,
          cancel_at_period_end: false,
          metadata: { personalId: tenantBId },
          items: { data: [{ price: { id: `price_billing_${suffix}` } }] },
        },
      },
    };
    const rawEvent = JSON.stringify(event);
    const signature = createHmac('sha256', testWebhookSecret)
      .update(`${timestamp}.${rawEvent}`)
      .digest('hex');
    const webhookResponse = await fetch(`${baseUrl}/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${timestamp},v1=${signature}`,
      },
      body: rawEvent,
    });
    expect(webhookResponse.status).toBe(200);
    await expect(webhookResponse.json()).resolves.toMatchObject({
      received: true,
      duplicate: false,
      stale: false,
    });
    await expect(prisma.billingSubscription.findUniqueOrThrow({
      where: { personalId: tenantBId },
    })).resolves.toMatchObject({ status: BillingStatus.ACTIVE, planId });
    expect((await fetch(`${baseUrl}/api/students`, {
      headers: { 'x-tenant': 'b' },
    })).status).toBe(200);

    const studentLimit = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Extra Student', email: `extra-${suffix}@test.invalid` }),
    });
    expect(studentLimit.status).toBe(409);
    await expect(studentLimit.json()).resolves.toMatchObject({
      code: 'PLAN_LIMIT_EXCEEDED',
      resource: 'students',
      limit: 1,
      current: 1,
    });

    const workoutLimit = await fetch(`${baseUrl}/api/workouts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId: studentAId,
        title: 'Extra Workout',
        exercises: [{ name: 'Bench', sets: 3, reps: '8', order: 0 }],
      }),
    });
    expect(workoutLimit.status).toBe(409);
    await expect(workoutLimit.json()).resolves.toMatchObject({
      code: 'PLAN_LIMIT_EXCEEDED',
      resource: 'workouts',
      limit: 1,
      current: 1,
    });
  });
});
