import { PrismaClient } from '@prisma/client';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/server';

const { assertSafeTestDatabaseEnv } = require('../scripts/test-db-safety.cjs') as {
  assertSafeTestDatabaseEnv: (env: NodeJS.ProcessEnv) => string;
};
const testDatabaseUrl = assertSafeTestDatabaseEnv(process.env);
const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
const userEmail = `workout-e2e-${crypto.randomUUID()}@test.invalid`;
const gifUrl = 'https://cdn.example.com/exercises/squat.gif';

let server: Server;
let baseUrl: string;
let personalId: string;
let billingPlanId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: userEmail,
      name: 'E2E Workout Personal',
      role: 'PERSONAL',
      provider: 'GOV_BR',
    },
  });
  const personal = await prisma.personal.create({
    data: { userId: user.id, name: 'E2E Workout Personal' },
  });
  personalId = personal.id;
  const plan = await prisma.plan.create({
    data: {
      name: `E2E Plan ${userEmail}`,
      stripePriceId: `price_${crypto.randomUUID()}`,
      maxStudents: 20,
      maxWorkouts: 50,
    },
  });
  billingPlanId = plan.id;
  await prisma.billingSubscription.create({
    data: {
      personalId,
      planId: billingPlanId,
      stripeSubscriptionId: `sub_${crypto.randomUUID()}`,
      stripePriceId: plan.stripePriceId,
      status: 'ACTIVE',
    },
  });

  server = createApp((req, _res, next) => {
    req.tenantId = personalId;
    req.auth = {
      userId: user.id,
      subject: user.id,
      role: 'PERSONAL',
      tenantId: personalId,
      personalId,
      studentId: null,
    };
    next();
  }).listen(0);
  await once(server, 'listening');

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Servidor E2E sem porta TCP');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (personalId) {
    await prisma.workout.deleteMany({ where: { personalId } });
    await prisma.student.deleteMany({ where: { personalId } });
    await prisma.billingSubscription.deleteMany({ where: { personalId } });
    if (billingPlanId) await prisma.plan.deleteMany({ where: { id: billingPlanId } });
    await prisma.personal.deleteMany({ where: { id: personalId } });
    await prisma.user.deleteMany({ where: { email: userEmail } });
  }
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await prisma.$disconnect();
});

describe('students and workouts HTTP E2E with PostgreSQL', () => {
  it('creates a student and persists a workout with exercises and GIF URLs', async () => {
    const studentResponse = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Student',
        email: `student-${crypto.randomUUID()}@test.invalid`,
      }),
    });

    const studentPayload = await studentResponse.json();
    expect(studentResponse.status, JSON.stringify(studentPayload)).toBe(201);
    const studentId = studentPayload.data.id as string;
    expect(studentPayload.data.personalId).toBe(personalId);

    const listResponse = await fetch(`${baseUrl}/api/students`);
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expect(listPayload.data.some((student: { id: string }) => student.id === studentId)).toBe(true);

    const workoutResponse = await fetch(`${baseUrl}/api/workouts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId,
        title: 'Plano E2E',
        exercises: [
          {
            name: 'Agachamento',
            gifUrl,
            sets: 3,
            reps: '8-12',
            restSeconds: 90,
            order: 0,
          },
          {
            name: 'Remada',
            sets: 4,
            reps: '10',
            order: 1,
          },
        ],
      }),
    });

    expect(workoutResponse.status).toBe(201);
    const workoutPayload = await workoutResponse.json();
    expect(workoutPayload.data.personalId).toBe(personalId);
    expect(workoutPayload.data.studentId).toBe(studentId);
    expect(workoutPayload.data.exercises).toHaveLength(2);
    expect(workoutPayload.data.exercises[0]).toMatchObject({
      name: 'Agachamento',
      gifUrl,
      personalId,
      order: 0,
    });
    expect(workoutPayload.data.exercises[1]).toMatchObject({
      name: 'Remada',
      gifUrl: null,
      personalId,
      order: 1,
    });

    const persistedExercises = await prisma.workoutExercise.findMany({
      where: { workoutId: workoutPayload.data.id, personalId },
      orderBy: { order: 'asc' },
    });
    expect(persistedExercises.map(({ gifUrl: persistedGif }) => persistedGif))
      .toEqual([gifUrl, null]);
  });
});
