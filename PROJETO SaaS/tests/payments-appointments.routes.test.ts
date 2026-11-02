import { once } from 'node:events';
import { Server } from 'node:http';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/server';

const { assertSafeTestDatabaseEnv } = require('../scripts/test-db-safety.cjs') as {
  assertSafeTestDatabaseEnv: (env: NodeJS.ProcessEnv) => string;
};
const testDatabaseUrl = assertSafeTestDatabaseEnv(process.env);
const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
const suffix = crypto.randomUUID();
const tenantA = `tenant-a-${suffix}`;
const tenantB = `tenant-b-${suffix}`;
let studentAId: string;
let studentBId: string;
let workoutAId: string;
let workoutBId: string;
let server: Server;
let baseUrl: string;

function authForTest(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tenantId = String(req.header('x-tenant') ?? '');
    const role = req.header('x-role') === 'STUDENT' ? 'STUDENT' : 'PERSONAL';
    req.tenantId = tenantId;
    req.auth = {
      userId: `test-user-${tenantId}`,
      subject: `test-sub-${tenantId}`,
      role,
      tenantId,
      personalId: tenantId,
      studentId: null,
    };
    next();
  };
}

async function request(path: string, tenantId = tenantA, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  headers.set('x-tenant', tenantId);
  return fetch(`${baseUrl}/api/${path}`, {
    ...options,
    headers,
  });
}

async function createTenant(id: string) {
  const user = await prisma.user.create({
    data: {
      email: `${id}@example.test`,
      name: id,
      role: 'PERSONAL',
      provider: 'OAUTH',
    },
  });
  const personal = await prisma.personal.create({ data: { id, userId: user.id, name: id } });
  const plan = await prisma.plan.create({
    data: {
      name: `Test plan ${id}`,
      stripePriceId: `price_${id}`,
      maxStudents: 20,
      maxWorkouts: 20,
    },
  });
  await prisma.billingSubscription.create({
    data: {
      personalId: personal.id,
      planId: plan.id,
      stripeSubscriptionId: `sub_${id}`,
      stripePriceId: plan.stripePriceId,
      status: 'ACTIVE',
    },
  });
  const student = await prisma.student.create({
    data: { personalId: personal.id, name: id, email: `${id}-student@example.test` },
  });
  const workout = await prisma.workout.create({
    data: { personalId: personal.id, studentId: student.id, title: `Workout ${id}` },
  });
  return { personal, plan, student, workout };
}

beforeAll(async () => {
  const [a, b] = await Promise.all([createTenant(tenantA), createTenant(tenantB)]);
  studentAId = a.student.id;
  studentBId = b.student.id;
  workoutAId = a.workout.id;
  workoutBId = b.workout.id;

  server = createApp(authForTest()).listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.appointment.deleteMany({ where: { personalId: { in: [tenantA, tenantB] } } });
  await prisma.workout.deleteMany({ where: { personalId: { in: [tenantA, tenantB] } } });
  await prisma.paymentParcel.deleteMany({ where: { personalId: { in: [tenantA, tenantB] } } });
  await prisma.contract.deleteMany({ where: { personalId: { in: [tenantA, tenantB] } } });
  await prisma.billingSubscription.deleteMany({ where: { personalId: { in: [tenantA, tenantB] } } });
  await prisma.student.deleteMany({ where: { personalId: { in: [tenantA, tenantB] } } });
  await prisma.personal.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await prisma.user.deleteMany({ where: { email: { in: [`${tenantA}@example.test`, `${tenantB}@example.test`] } } });
  await prisma.plan.deleteMany({ where: { stripePriceId: { in: [`price_${tenantA}`, `price_${tenantB}`] } } });
  await prisma.$disconnect();
});

describe('payments routes', () => {
  it('creates monthly parcels, lists them tenant-scoped, and confirms only within that tenant', async () => {
    const createResponse = await request('payments/contracts', tenantA, {
      method: 'POST',
      body: JSON.stringify({
        studentId: studentAId,
        cycle: 'MONTHS_3',
        monthlyAmount: 55,
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json() as { data: { parcels: Array<{ id: string }> } }).data;
    expect(created.parcels).toHaveLength(3);

    const [tenantPayments, otherTenantPayments] = await Promise.all([
      request('payments'),
      request('payments', tenantB),
    ]);
    expect((await tenantPayments.json() as { data: unknown[] }).data).toHaveLength(3);
    expect((await otherTenantPayments.json() as { data: unknown[] }).data).toHaveLength(0);

    const paymentId = created.parcels[0].id;
    const crossTenantConfirm = await request(`payments/${paymentId}/confirm`, tenantB, { method: 'PATCH' });
    expect(crossTenantConfirm.status).toBe(404);
    const confirmResponse = await request(`payments/${paymentId}/confirm`, tenantA, { method: 'PATCH' });
    expect(confirmResponse.status).toBe(200);
    expect((await confirmResponse.json() as { data: { status: string } }).data.status).toBe('CONFIRMED');
  });

  it('rejects invalid input and non-personal roles', async () => {
    const invalid = await request('payments/contracts', tenantA, {
      method: 'POST',
      body: JSON.stringify({ studentId: studentAId, cycle: 'MONTHS_4', monthlyAmount: -2, startDate: 'invalid' }),
    });
    expect(invalid.status).toBe(400);

    const studentRole = await request('payments', tenantA, {
      headers: { 'x-role': 'STUDENT' },
    });
    expect(studentRole.status).toBe(403);
  });
});

describe('appointments routes', () => {
  it('prevents tenant-local schedule conflicts and keeps appointments isolated', async () => {
    const startsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const appointment = {
      title: 'Sessão de avaliação',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
    const createdResponse = await request('appointments', tenantA, {
      method: 'POST',
      body: JSON.stringify({ ...appointment, studentId: studentAId, workoutId: workoutAId }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json() as {
      data: { id: string; workout: { id: string; title: string } };
    }).data;
    expect(created.workout).toEqual({ id: workoutAId, title: `Workout ${tenantA}` });

    const foreignWorkout = await request('appointments', tenantA, {
      method: 'POST',
      body: JSON.stringify({
        ...appointment,
        studentId: studentAId,
        workoutId: workoutBId,
        startsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(endsAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      }),
    });
    expect(foreignWorkout.status).toBe(404);

    const conflict = await request('appointments', tenantA, {
      method: 'POST',
      body: JSON.stringify({
        ...appointment,
        studentId: studentAId,
        startsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
        endsAt: new Date(endsAt.getTime() + 30 * 60 * 1000).toISOString(),
      }),
    });
    expect(conflict.status).toBe(409);

    const sameTimeOtherTenant = await request('appointments', tenantB, {
      method: 'POST',
      body: JSON.stringify({ ...appointment, studentId: studentBId }),
    });
    expect(sameTimeOtherTenant.status).toBe(201);

    const from = new Date(startsAt.getTime() - 60 * 1000).toISOString();
    const to = new Date(endsAt.getTime() + 60 * 1000).toISOString();
    const [aList, bList] = await Promise.all([
      request(`appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      request(`appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, tenantB),
    ]);
    const appointmentsForA = (await aList.json() as {
      data: Array<{ id: string; workout: { id: string; title: string } | null }>;
    }).data;
    expect(appointmentsForA.map(({ id }) => id)).toEqual([created.id]);
    expect(appointmentsForA[0].workout).toEqual({ id: workoutAId, title: `Workout ${tenantA}` });
    expect((await bList.json() as { data: Array<{ id: string }> }).data).toHaveLength(1);

    const completed = await request(`appointments/${created.id}/status`, tenantA, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    expect(completed.status).toBe(200);
    const repeatedTransition = await request(`appointments/${created.id}/status`, tenantA, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    expect(repeatedTransition.status).toBe(409);
  });
});
