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
const userEmail = `profile-${crypto.randomUUID()}@test.invalid`;

let server: Server;
let baseUrl: string;
let userId: string;
let personalId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: userEmail,
      name: 'Initial Trainer Name',
      role: 'PERSONAL',
      provider: 'GOV_BR',
      providerSub: `profile-${crypto.randomUUID()}`,
    },
  });
  userId = user.id;
  const personal = await prisma.personal.create({
    data: { userId, name: 'Initial Trainer Name' },
  });
  personalId = personal.id;

  server = createApp((req, _res, next) => {
    req.tenantId = personalId;
    req.auth = {
      userId,
      subject: user.providerSub!,
      role: 'PERSONAL',
      tenantId: personalId,
      personalId,
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
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await prisma.$disconnect();
});

describe('personal profile HTTP E2E', () => {
  it('reads and atomically updates the authenticated profile name without changing identity', async () => {
    const read = await fetch(`${baseUrl}/api/profile/me`);
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({
      data: { id: personalId, name: 'Initial Trainer Name', email: userEmail },
    });

    const update = await fetch(`${baseUrl}/api/profile/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Trainer Name' }),
    });
    expect(update.status).toBe(200);
    await expect(update.json()).resolves.toMatchObject({
      data: { id: personalId, name: 'Updated Trainer Name', email: userEmail },
    });

    const [personal, user] = await Promise.all([
      prisma.personal.findUniqueOrThrow({ where: { id: personalId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    expect(personal.name).toBe('Updated Trainer Name');
    expect(user.name).toBe('Updated Trainer Name');
    expect(user.email).toBe(userEmail);
    expect(user.role).toBe('PERSONAL');
  });
});
