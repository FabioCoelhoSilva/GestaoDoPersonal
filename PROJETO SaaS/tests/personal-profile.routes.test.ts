import express, { RequestHandler } from 'express';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPersonalProfileRouter,
  PersonalProfileReader,
} from '../src/profile/personal-profile.routes';

const profile = {
  id: 'tenant-1',
  name: 'Trainer One',
  email: 'trainer@example.com',
};
const getProfile = vi.fn(async () => profile);
const updateProfile = vi.fn(async (_userId: string, _tenantId: string, input: { name: string }) => ({
  ...profile,
  name: input.name,
}));
const writeAudit = vi.fn(async () => ({} as never));
let role: 'PERSONAL' | 'STUDENT' | null = 'PERSONAL';
let authTenantId: string | null = 'tenant-1';
let requestTenantId: string | undefined = 'tenant-1';
let server: Server;
let baseUrl: string;

const injectAuth: RequestHandler = (req, _res, next) => {
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
  req.tenantId = requestTenantId;
  next();
};

beforeEach(async () => {
  role = 'PERSONAL';
  authTenantId = 'tenant-1';
  requestTenantId = 'tenant-1';
  vi.clearAllMocks();
  const service: PersonalProfileReader = { getProfile, updateProfile };
  const app = express();
  app.use(express.json());
  app.use('/api/profile', injectAuth, createPersonalProfileRouter(service, writeAudit));
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

describe('personal profile routes', () => {
  it('returns the authenticated personal profile without accepting a target ID', async () => {
    const response = await fetch(`${baseUrl}/api/profile/me`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: profile });
    expect(getProfile).toHaveBeenCalledWith('user-1', 'tenant-1');
  });

  it('updates only the name and audits the authenticated tenant', async () => {
    const response = await fetch(`${baseUrl}/api/profile/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Trainer Two' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { ...profile, name: 'Trainer Two' },
    });
    expect(updateProfile).toHaveBeenCalledWith('user-1', 'tenant-1', { name: 'Trainer Two' });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      personalId: 'tenant-1',
      resource: 'personal.profile',
    }));
  });

  it('rejects unauthenticated, non-personal, and mismatched-tenant requests', async () => {
    role = null;
    expect((await fetch(`${baseUrl}/api/profile/me`)).status).toBe(401);

    role = 'STUDENT';
    expect((await fetch(`${baseUrl}/api/profile/me`)).status).toBe(403);

    role = 'PERSONAL';
    authTenantId = 'tenant-2';
    expect((await fetch(`${baseUrl}/api/profile/me`)).status).toBe(403);
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('rejects email, role, tenant injection and malformed names', async () => {
    for (const body of [
      { name: 'Trainer Two', email: 'new@example.com' },
      { name: 'Trainer Two', role: 'ADMIN' },
      { name: 'Trainer Two', personalId: 'tenant-2' },
      { name: 'x' },
    ]) {
      const response = await fetch(`${baseUrl}/api/profile/me`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
    }
    expect(updateProfile).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });
});
