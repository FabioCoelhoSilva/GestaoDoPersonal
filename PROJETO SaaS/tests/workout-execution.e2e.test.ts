import { PrismaClient } from '@prisma/client';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/server';
import { findPersonalAuthContextByProviderSub } from '../src/db/scoped-prisma';
import { createWorkoutPlan } from '../src/students/student-workout.service';

const { assertSafeTestDatabaseEnv } = require('../scripts/test-db-safety.cjs') as {
  assertSafeTestDatabaseEnv: (env: NodeJS.ProcessEnv) => string;
};
const testDatabaseUrl = assertSafeTestDatabaseEnv(process.env);
const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
const userSuffix = crypto.randomUUID();

let server: Server;
let baseUrl: string;
let personalIdA: string;
let personalIdB: string;
let billingPlanId: string;
let studentIdA: string;
let studentIdB: string;
let workoutIdA: string;
let exerciseIdA: string;
let workoutIdB: string;
let exerciseIdB: string;

beforeAll(async () => {
  const [personalUserA, personalUserB, studentUserA, studentUserB] = await Promise.all([
    prisma.user.create({
      data: { email: `personal-a-${userSuffix}@test.invalid`, name: 'Personal A', role: 'PERSONAL', provider: 'GOV_BR' },
    }),
    prisma.user.create({
      data: { email: `personal-b-${userSuffix}@test.invalid`, name: 'Personal B', role: 'PERSONAL', provider: 'GOV_BR' },
    }),
    prisma.user.create({
      data: {
        email: `student-a-${userSuffix}@test.invalid`,
        name: 'Student A',
        role: 'STUDENT',
        provider: 'GOV_BR',
        providerSub: `student-a-${userSuffix}`,
      },
    }),
    prisma.user.create({
      data: {
        email: `student-b-${userSuffix}@test.invalid`,
        name: 'Student B',
        role: 'STUDENT',
        provider: 'GOV_BR',
        providerSub: `student-b-${userSuffix}`,
      },
    }),
  ]);
  const [personalA, personalB] = await Promise.all([
    prisma.personal.create({ data: { userId: personalUserA.id, name: 'Personal A' } }),
    prisma.personal.create({ data: { userId: personalUserB.id, name: 'Personal B' } }),
  ]);
  personalIdA = personalA.id;
  personalIdB = personalB.id;
  const plan = await prisma.plan.create({
    data: {
      name: `Workout Execution Plan ${userSuffix}`,
      stripePriceId: `price_execution_${userSuffix}`,
      maxStudents: 100,
      maxWorkouts: 100,
    },
  });
  billingPlanId = plan.id;
  await prisma.billingSubscription.createMany({
    data: [personalIdA, personalIdB].map((personalId, index) => ({
      personalId,
      planId: plan.id,
      stripeSubscriptionId: `sub_execution_${userSuffix}_${index}`,
      stripePriceId: plan.stripePriceId,
      status: 'ACTIVE' as const,
    })),
  });

  const [studentA, studentB] = await Promise.all([
    prisma.student.create({
      data: {
        personalId: personalIdA,
        userId: studentUserA.id,
        name: 'Student A',
        email: `student-a-${userSuffix}@test.invalid`,
      },
    }),
    prisma.student.create({
      data: {
        personalId: personalIdB,
        userId: studentUserB.id,
        name: 'Student B',
        email: `student-b-${userSuffix}@test.invalid`,
      },
    }),
  ]);
  studentIdA = studentA.id;
  studentIdB = studentB.id;
  await expect(findPersonalAuthContextByProviderSub(`student-a-${userSuffix}`))
    .resolves.toMatchObject({
      userId: studentUserA.id,
      role: 'STUDENT',
      tenantId: personalIdA,
      studentId: studentIdA,
    });

  const [workoutA, workoutB] = await Promise.all([
    createWorkoutPlan(personalIdA, {
      studentId: studentIdA,
      title: 'Plano A',
      exercises: [{ name: 'Agachamento', sets: 3, reps: '8-12', order: 0 }],
    }),
    createWorkoutPlan(personalIdB, {
      studentId: studentIdB,
      title: 'Plano B',
      exercises: [{ name: 'Remada', sets: 3, reps: '10', order: 0 }],
    }),
  ]);
  workoutIdA = workoutA.id;
  workoutIdB = workoutB.id;
  exerciseIdA = workoutA.exercises[0].id;
  exerciseIdB = workoutB.exercises[0].id;

  server = createApp((req, _res, next) => {
    const asStudentB = req.header('x-e2e-identity') === 'student-b';
    const asPersonal = req.header('x-e2e-identity') === 'personal-a';
    const identity = asStudentB
      ? { userId: studentUserB.id, role: 'STUDENT' as const, tenantId: personalIdB, studentId: studentIdB }
      : asPersonal
        ? { userId: personalUserA.id, role: 'PERSONAL' as const, tenantId: personalIdA, studentId: null }
        : { userId: studentUserA.id, role: 'STUDENT' as const, tenantId: personalIdA, studentId: studentIdA };
    req.tenantId = identity.tenantId;
    req.auth = {
      ...identity,
      subject: identity.userId,
      personalId: identity.tenantId,
    };
    next();
  }).listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor E2E sem porta TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (personalIdA) {
    await prisma.workoutExecution.deleteMany({
      where: { personalId: { in: [personalIdA, personalIdB] } },
    });
    await prisma.workout.deleteMany({
      where: { personalId: { in: [personalIdA, personalIdB] } },
    });
    await prisma.student.deleteMany({
      where: { personalId: { in: [personalIdA, personalIdB] } },
    });
    await prisma.billingSubscription.deleteMany({
      where: { personalId: { in: [personalIdA, personalIdB] } },
    });
    if (billingPlanId) await prisma.plan.deleteMany({ where: { id: billingPlanId } });
    await prisma.personal.deleteMany({ where: { id: { in: [personalIdA, personalIdB] } } });
    await prisma.user.deleteMany({ where: { email: { contains: userSuffix } } });
  }
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await prisma.$disconnect();
});

describe('workout execution HTTP E2E with tenant isolation', () => {
  it('lets a student log, complete, and read only their own workout', async () => {
    const created = await fetch(`${baseUrl}/api/workout-executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workoutId: workoutIdA,
        completed: false,
        sets: [{
          workoutExerciseId: exerciseIdA,
          setNumber: 1,
          repsCompleted: 10,
          loadKg: 42.5,
        }],
      }),
    });
    expect(created.status).toBe(201);
    const payload = await created.json();
    expect(payload.data).toMatchObject({
      personalId: personalIdA,
      studentId: studentIdA,
      workoutId: workoutIdA,
      status: 'IN_PROGRESS',
    });
    expect(payload.data.completedAt).toBeNull();
    expect(payload.data.setLogs).toHaveLength(1);
    expect(payload.data.setLogs[0]).toMatchObject({
      personalId: personalIdA,
      workoutExerciseId: exerciseIdA,
      setNumber: 1,
      repsCompleted: 10,
      loadKg: '42.5',
    });

    const completed = await fetch(
      `${baseUrl}/api/workout-executions/${payload.data.id}/complete`,
      { method: 'PATCH' },
    );
    expect(completed.status).toBe(200);
    const completedPayload = await completed.json();
    expect(completedPayload.data.status).toBe('COMPLETED');
    expect(completedPayload.data.completedAt).toBeTruthy();

    const history = await fetch(`${baseUrl}/api/workout-executions`);
    expect(history.status).toBe(200);
    const historyPayload = await history.json();
    expect(historyPayload.data).toHaveLength(1);
    expect(historyPayload.data[0].studentId).toBe(studentIdA);

    await expect(prisma.workoutSetLog.create({
      data: {
        personalId: personalIdA,
        workoutId: workoutIdA,
        executionId: payload.data.id,
        workoutExerciseId: exerciseIdB,
        setNumber: 99,
        repsCompleted: 1,
        loadKg: 1,
      },
    })).rejects.toThrow(/must match its exercise/);
  });

  it('blocks student IDOR attempts across students and tenants', async () => {
    const crossTenantExecution = await fetch(`${baseUrl}/api/workout-executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-e2e-identity': 'student-a' },
      body: JSON.stringify({
        workoutId: workoutIdB,
        completed: true,
        sets: [{
          workoutExerciseId: exerciseIdB,
          setNumber: 1,
          repsCompleted: 10,
          loadKg: 20,
        }],
      }),
    });
    expect(crossTenantExecution.status).toBe(404);

    const crossStudentHistory = await fetch(
      `${baseUrl}/api/workout-executions?studentId=${studentIdB}`,
    );
    expect(crossStudentHistory.status).toBe(403);

    const tenantBHistory = await fetch(`${baseUrl}/api/workout-executions`, {
      headers: { 'x-e2e-identity': 'student-b' },
    });
    expect(tenantBHistory.status).toBe(200);
    await expect(tenantBHistory.json()).resolves.toMatchObject({ data: [] });
  });

  it('allows the tenant personal to log and list an execution for its student', async () => {
    const created = await fetch(`${baseUrl}/api/workout-executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-e2e-identity': 'personal-a' },
      body: JSON.stringify({
        workoutId: workoutIdA,
        studentId: studentIdA,
        completed: false,
        sets: [{
          workoutExerciseId: exerciseIdA,
          setNumber: 2,
          repsCompleted: 8,
          loadKg: 40,
        }],
      }),
    });
    expect(created.status).toBe(201);
    const payload = await created.json();
    expect(payload.data).toMatchObject({
      personalId: personalIdA,
      studentId: studentIdA,
      status: 'IN_PROGRESS',
      completedAt: null,
    });

    const history = await fetch(
      `${baseUrl}/api/workout-executions?studentId=${studentIdA}`,
      { headers: { 'x-e2e-identity': 'personal-a' } },
    );
    expect(history.status).toBe(200);
    const historyPayload = await history.json();
    expect(historyPayload.data.map((execution: { id: string }) => execution.id))
      .toContain(payload.data.id);
  });
});
