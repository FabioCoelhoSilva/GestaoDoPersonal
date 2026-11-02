import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware, type AuthenticatedRequest } from '../src/api/auth';

function createTestApp(
  getUser: (token: string) => Promise<{ id: string } | null>,
  findUser: (id: string) => Promise<{
    id: string;
    name: string;
    email: string;
    role: string;
    personal: { id: string } | null;
  } | null>,
) {
  const app = express();
  app.use(createAuthMiddleware(getUser, findUser));
  app.get('/', (req, res) => res.json((req as AuthenticatedRequest).auth));
  return app;
}

describe('autenticação da API', () => {
  it('rejeita chamadas sem sessão', async () => {
    const response = await request(createTestApp(vi.fn(), vi.fn())).get('/');
    expect(response.status).toBe(401);
  });

  it('não permite usar uma conta que não está vinculada ao personal', async () => {
    const response = await request(createTestApp(
      async () => ({ id: 'auth-user-id' }),
      async () => null,
    ))
      .get('/')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
  });

  it('obtém o tenant exclusivamente do cadastro vinculado à identidade verificada', async () => {
    const findUser = vi.fn(async () => ({
      id: 'database-user-id',
      name: 'Fabio',
      email: 'fabio@example.com',
      role: 'PERSONAL',
      personal: { id: 'tenant-from-database' },
    }));
    const response = await request(createTestApp(
      async () => ({ id: 'auth-user-id' }),
      findUser,
    ))
      .get('/')
      .query({ personalId: 'another-tenant' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.personalId).toBe('tenant-from-database');
    expect(findUser).toHaveBeenCalledWith('auth-user-id');
  });
});
