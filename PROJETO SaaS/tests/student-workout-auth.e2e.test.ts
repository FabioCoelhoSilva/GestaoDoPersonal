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
const issuer = 'https://e2e-project.supabase.co/auth/v1';
const suffix = crypto.randomUUID();

let server: Server | undefined;
let baseUrl: string;
let personalId: string | undefined;
let userId: string | undefined;
let planId: string | undefined;
let stripePriceId: string;
let token: string;

beforeAll(async () => {
  const { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const publicJwk = await exportJWK(publicKey);
  const keyResolver: JWTVerifyGetKey = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: 'student-workout-e2e', alg: 'ES256', use: 'sig' }],
  });
  const providerSub = `supabase-e2e-${suffix}`;
  const user = await prisma.user.create({
    data: {
      email: `personal-${suffix}@test.invalid`,
      name: 'Personal E2E',
      role: 'PERSONAL',
      provider: 'GOV_BR',
      providerSub,
    },
  });
  userId = user.id;
  const personal = await prisma.personal.create({
    data: { userId: user.id, name: user.name },
  });
  personalId = personal.id;

  const plan = await prisma.plan.create({
    data: {
      name: `E2E Active Plan ${suffix}`,
      stripePriceId: `price_e2e_${suffix}`,
      maxStudents: 5,
      maxWorkouts: 5,
    },
  });
  planId = plan.id;
  stripePriceId = plan.stripePriceId;
  await prisma.billingSubscription.create({
    data: {
      personalId: personal.id,
      planId: plan.id,
      stripeSubscriptionId: `sub_e2e_${suffix}`,
      stripePriceId: plan.stripePriceId,
      status: BillingStatus.ACTIVE,
    },
  });

  token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'student-workout-e2e' })
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setSubject(providerSub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  const authMiddleware = createSupabaseAuthMiddleware({ keyResolver, issuer });
  server = createApp(authMiddleware).listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Servidor E2E sem porta TCP');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  try {
    if (personalId) {
      await prisma.workoutExecution.deleteMany({ where: { personalId } });
      await prisma.workout.deleteMany({ where: { personalId } });
      await prisma.student.deleteMany({ where: { personalId } });
      await prisma.billingSubscription.deleteMany({ where: { personalId } });
      await prisma.stripeWebhookEvent.deleteMany({ where: { personalId } });
      if (planId) await prisma.plan.deleteMany({ where: { id: planId } });
      await prisma.personal.deleteMany({ where: { id: personalId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await prisma.$disconnect();
  }
});

describe('authenticated student and workout lifecycle E2E', () => {
  it('authenticates with a signed JWT, creates tenant-owned data, and soft-deletes it', async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/students`);
    expect(unauthenticated.status).toBe(401);

    const invalidToken = await fetch(`${baseUrl}/api/students`, {
      headers: { authorization: 'Bearer invalid.jwt.token' },
    });
    expect(invalidToken.status).toBe(401);

    const authHeaders = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const studentResponse = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Aluno JWT E2E',
        email: `student-${suffix}@test.invalid`,
      }),
    });
    const studentPayload = await studentResponse.json();
    expect(studentResponse.status, JSON.stringify(studentPayload)).toBe(201);
    const studentId = studentPayload.data.id as string;
    expect(studentPayload.data).toMatchObject({
      personalId,
      name: 'Aluno JWT E2E',
    });

    const studentList = await fetch(`${baseUrl}/api/students`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(studentList.status).toBe(200);
    await expect(studentList.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: studentId, personalId })],
    });

    const workoutResponse = await fetch(`${baseUrl}/api/workouts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        studentId,
        title: 'Plano JWT E2E',
        exercises: [
          {
            name: 'Agachamento',
            gifUrl: 'https://cdn.example.test/squat.gif',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            order: 0,
          },
          {
            name: 'Remada',
            sets: 3,
            reps: '10-12',
            order: 1,
          },
        ],
      }),
    });
    const workoutPayload = await workoutResponse.json();
    expect(workoutResponse.status, JSON.stringify(workoutPayload)).toBe(201);
    const workoutId = workoutPayload.data.id as string;
    expect(workoutPayload.data).toMatchObject({
      personalId,
      studentId,
      title: 'Plano JWT E2E',
      exercises: [
        expect.objectContaining({
          name: 'Agachamento',
          gifUrl: 'https://cdn.example.test/squat.gif',
          personalId,
          order: 0,
        }),
        expect.objectContaining({
          name: 'Remada',
          personalId,
          order: 1,
        }),
      ],
    });
    expect(workoutPayload.data.exercises).toHaveLength(2);

    const [persistedStudent, persistedWorkout, persistedExercises, persistedSubscription] =
      await Promise.all([
        prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
        prisma.workout.findUniqueOrThrow({ where: { id: workoutId } }),
        prisma.workoutExercise.findMany({
          where: { workoutId, personalId },
          orderBy: { order: 'asc' },
        }),
        prisma.billingSubscription.findUniqueOrThrow({ where: { personalId: personalId! } }),
      ]);
    expect(persistedStudent.personalId).toBe(personalId);
    expect(persistedWorkout.personalId).toBe(personalId);
    expect(persistedExercises.map(({ name }) => name)).toEqual(['Agachamento', 'Remada']);
    expect(persistedSubscription.planId).toBe(planId);
    expect(persistedSubscription.stripePriceId).toBe(stripePriceId);

    const deactivateStudent = await fetch(`${baseUrl}/api/students/${studentId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deactivateStudent.status).toBe(200);
    await expect(deactivateStudent.json()).resolves.toMatchObject({
      data: { id: studentId, personalId, active: false },
    });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: studentId } }))
      .resolves.toMatchObject({ personalId, active: false });

    const archiveWorkout = await fetch(`${baseUrl}/api/workouts/${workoutId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(archiveWorkout.status).toBe(200);
    await expect(archiveWorkout.json()).resolves.toMatchObject({
      data: { id: workoutId, personalId, active: false },
    });
    await expect(prisma.workout.findUniqueOrThrow({ where: { id: workoutId } }))
      .resolves.toMatchObject({ personalId, active: false });
    await expect(prisma.workoutExercise.count({ where: { workoutId, personalId } }))
      .resolves.toBe(2);

    const studentsAfterDeactivation = await fetch(`${baseUrl}/api/students`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(studentsAfterDeactivation.status).toBe(200);
    await expect(studentsAfterDeactivation.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: studentId, active: false })],
    });
  });
});
