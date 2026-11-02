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
const otherUserEmail = `workout-e2e-other-${crypto.randomUUID()}@test.invalid`;
const gifUrl = 'https://cdn.example.com/exercises/squat.gif';

let server: Server;
let baseUrl: string;
let personalId: string;
let otherPersonalId: string;
let billingPlanId: string;
let otherUserId: string;

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
  const otherUser = await prisma.user.create({
    data: {
      email: otherUserEmail,
      name: 'Other E2E Personal',
      role: 'PERSONAL',
      provider: 'GOV_BR',
    },
  });
  otherUserId = otherUser.id;
  const otherPersonal = await prisma.personal.create({
    data: { userId: otherUserId, name: 'Other E2E Personal' },
  });
  otherPersonalId = otherPersonal.id;
  await prisma.billingSubscription.create({
    data: {
      personalId: otherPersonalId,
      planId: billingPlanId,
      stripeSubscriptionId: `sub_${crypto.randomUUID()}`,
      stripePriceId: plan.stripePriceId,
      status: 'ACTIVE',
    },
  });

  server = createApp((req, _res, next) => {
    const otherTenant = req.header('x-e2e-tenant') === 'other';
    const tenantId = otherTenant ? otherPersonalId : personalId;
    const authenticatedUserId = otherTenant ? otherUserId : user.id;
    req.tenantId = tenantId;
    req.auth = {
      userId: authenticatedUserId,
      subject: authenticatedUserId,
      role: 'PERSONAL',
      tenantId,
      personalId: tenantId,
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
  if (personalId && otherPersonalId) {
    const tenantIds = [personalId, otherPersonalId];
    await prisma.workoutExecution.deleteMany({ where: { personalId: { in: tenantIds } } });
    await prisma.workout.deleteMany({ where: { personalId: { in: tenantIds } } });
    await prisma.student.deleteMany({ where: { personalId: { in: tenantIds } } });
    await prisma.billingSubscription.deleteMany({ where: { personalId: { in: tenantIds } } });
    if (billingPlanId) await prisma.plan.deleteMany({ where: { id: billingPlanId } });
    await prisma.personal.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [userEmail, otherUserEmail] } } });
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

    const foreignStudent = await fetch(`${baseUrl}/api/students/${studentId}`, {
      headers: { 'x-e2e-tenant': 'other' },
    });
    expect(foreignStudent.status).toBe(404);
    const foreignWorkoutUpdate = await fetch(`${baseUrl}/api/workouts/${workoutPayload.data.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-e2e-tenant': 'other',
      },
      body: JSON.stringify({ title: 'Cross-tenant mutation' }),
    });
    expect(foreignWorkoutUpdate.status).toBe(404);

    const readStudent = await fetch(`${baseUrl}/api/students/${studentId}`);
    expect(readStudent.status).toBe(200);
    await expect(readStudent.json()).resolves.toMatchObject({
      data: { id: studentId, personalId, name: 'E2E Student' },
    });

    const updateStudent = await fetch(`${baseUrl}/api/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Student Updated' }),
    });
    expect(updateStudent.status).toBe(200);
    await expect(updateStudent.json()).resolves.toMatchObject({
      data: { id: studentId, name: 'E2E Student Updated' },
    });

    const listWorkouts = await fetch(`${baseUrl}/api/workouts`);
    expect(listWorkouts.status).toBe(200);
    await expect(listWorkouts.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: workoutPayload.data.id, personalId })],
    });

    const updateWorkout = await fetch(`${baseUrl}/api/workouts/${workoutPayload.data.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Plano E2E Atualizado' }),
    });
    expect(updateWorkout.status).toBe(200);
    await expect(updateWorkout.json()).resolves.toMatchObject({
      data: { id: workoutPayload.data.id, title: 'Plano E2E Atualizado' },
    });

    const exerciseList = await fetch(`${baseUrl}/api/workouts/${workoutPayload.data.id}/exercises`);
    expect(exerciseList.status).toBe(200);
    await expect(exerciseList.json()).resolves.toMatchObject({
      data: [
        expect.objectContaining({ id: persistedExercises[0].id, name: 'Agachamento' }),
        expect.objectContaining({ id: persistedExercises[1].id, name: 'Remada' }),
      ],
    });

    const updatedExercise = await fetch(
      `${baseUrl}/api/workout-exercises/${persistedExercises[0].id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'Execução controlada' }),
      },
    );
    expect(updatedExercise.status).toBe(200);
    await expect(updatedExercise.json()).resolves.toMatchObject({
      data: { id: persistedExercises[0].id, notes: 'Execução controlada' },
    });

    const addedExercise = await fetch(
      `${baseUrl}/api/workouts/${workoutPayload.data.id}/exercises`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Prancha',
          sets: 3,
          reps: '30 segundos',
          order: 2,
        }),
      },
    );
    const addedExercisePayload = await addedExercise.json();
    expect(addedExercise.status, JSON.stringify(addedExercisePayload)).toBe(201);
    expect(addedExercisePayload.data).toMatchObject({
      personalId,
      workoutId: workoutPayload.data.id,
      name: 'Prancha',
      order: 2,
    });

    const deletedExercise = await fetch(
      `${baseUrl}/api/workout-exercises/${addedExercisePayload.data.id}`,
      { method: 'DELETE' },
    );
    expect(deletedExercise.status).toBe(204);

    const execution = await prisma.workoutExecution.create({
      data: {
        personalId,
        studentId,
        workoutId: workoutPayload.data.id,
      },
    });
    await prisma.workoutSetLog.create({
      data: {
        personalId,
        workoutId: workoutPayload.data.id,
        executionId: execution.id,
        workoutExerciseId: persistedExercises[0].id,
        setNumber: 1,
        repsCompleted: 8,
      },
    });
    const protectedExerciseUpdate = await fetch(
      `${baseUrl}/api/workout-exercises/${persistedExercises[0].id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'Não deve substituir histórico' }),
      },
    );
    expect(protectedExerciseUpdate.status).toBe(409);

    const protectedExerciseDelete = await fetch(
      `${baseUrl}/api/workout-exercises/${persistedExercises[0].id}`,
      { method: 'DELETE' },
    );
    expect(protectedExerciseDelete.status).toBe(409);

    const archivedWorkout = await fetch(`${baseUrl}/api/workouts/${workoutPayload.data.id}`, {
      method: 'DELETE',
    });
    expect(archivedWorkout.status).toBe(200);
    await expect(archivedWorkout.json()).resolves.toMatchObject({
      data: { id: workoutPayload.data.id, active: false },
    });

    const deactivatedStudent = await fetch(`${baseUrl}/api/students/${studentId}`, {
      method: 'DELETE',
    });
    expect(deactivatedStudent.status).toBe(200);
    await expect(deactivatedStudent.json()).resolves.toMatchObject({
      data: { id: studentId, active: false },
    });
  });
});
