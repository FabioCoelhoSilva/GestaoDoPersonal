import { PrismaClient, WorkoutExecutionStatus } from '@prisma/client';
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
let tenantAId: string;
let tenantBId: string;
let userAId: string;
let userBId: string;
let billingPlanId: string;
let workoutAId: string;
let workoutBId: string;

beforeAll(async () => {
  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: { email: `dashboard-a-${suffix}@test.invalid`, name: 'Dashboard A', role: 'PERSONAL', provider: 'GOV_BR' },
    }),
    prisma.user.create({
      data: { email: `dashboard-b-${suffix}@test.invalid`, name: 'Dashboard B', role: 'PERSONAL', provider: 'GOV_BR' },
    }),
  ]);
  userAId = userA.id;
  userBId = userB.id;

  const [personalA, personalB] = await Promise.all([
    prisma.personal.create({ data: { userId: userA.id, name: 'Dashboard A' } }),
    prisma.personal.create({ data: { userId: userB.id, name: 'Dashboard B' } }),
  ]);
  tenantAId = personalA.id;
  tenantBId = personalB.id;

  const billingPlan = await prisma.plan.create({
    data: {
      name: `Dashboard Plan ${suffix}`,
      stripePriceId: `price_${suffix}`,
      maxStudents: 100,
      maxWorkouts: 100,
    },
  });
  billingPlanId = billingPlan.id;
  await prisma.billingSubscription.createMany({
    data: [tenantAId, tenantBId].map((personalId, index) => ({
      personalId,
      planId: billingPlan.id,
      stripeSubscriptionId: `sub_dashboard_${suffix}_${index}`,
      stripePriceId: billingPlan.stripePriceId,
      status: 'ACTIVE' as const,
    })),
  });

  const [studentA, studentB] = await Promise.all([
    prisma.student.create({
      data: { personalId: tenantAId, name: 'Student A', email: `student-a-${suffix}@test.invalid` },
    }),
    prisma.student.create({
      data: { personalId: tenantBId, name: 'Student B', email: `student-b-${suffix}@test.invalid` },
    }),
  ]);

  const [workoutA, workoutB] = await Promise.all([
    createWorkoutPlan(tenantAId, {
      studentId: studentA.id,
      title: 'Plano A',
      exercises: [{ name: 'Agachamento', sets: 3, reps: '8-12', order: 0 }],
    }),
    createWorkoutPlan(tenantBId, {
      studentId: studentB.id,
      title: 'Plano B',
      exercises: [{ name: 'Remada', sets: 3, reps: '10', order: 0 }],
    }),
  ]);
  workoutAId = workoutA.id;
  workoutBId = workoutB.id;

  await Promise.all([
    prisma.workoutExecution.create({
      data: {
        personalId: tenantAId,
        studentId: studentA.id,
        workoutId: workoutAId,
        status: WorkoutExecutionStatus.COMPLETED,
        completedAt: new Date(),
      },
    }),
    prisma.workoutExecution.create({
      data: {
        personalId: tenantAId,
        studentId: studentA.id,
        workoutId: workoutAId,
      },
    }),
    prisma.workoutExecution.create({
      data: {
        personalId: tenantBId,
        studentId: studentB.id,
        workoutId: workoutBId,
        status: WorkoutExecutionStatus.COMPLETED,
        completedAt: new Date(),
      },
    }),
  ]);

  server = createApp((req, _res, next) => {
    req.tenantId = tenantAId;
    req.auth = {
      userId: userAId,
      subject: userAId,
      role: 'PERSONAL',
      tenantId: tenantAId,
      personalId: tenantAId,
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
    await prisma.workoutExecution.deleteMany({
      where: { personalId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.workout.deleteMany({
      where: { personalId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.student.deleteMany({
      where: { personalId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.billingSubscription.deleteMany({
      where: { personalId: { in: [tenantAId, tenantBId] } },
    });
    if (billingPlanId) await prisma.plan.deleteMany({ where: { id: billingPlanId } });
    await prisma.personal.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  }
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await prisma.$disconnect();
});

describe('dashboard metrics HTTP E2E tenant isolation', () => {
  it('aggregates only the authenticated personal tenant', async () => {
    const response = await fetch(`${baseUrl}/api/dashboard/metrics`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        activeStudents: 1,
        workoutPlans: 1,
        sessions: { executed: 1, inProgress: 1, total: 2 },
      },
    });
  });
});
