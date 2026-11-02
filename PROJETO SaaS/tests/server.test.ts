import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/server';

const WEBHOOK_SECRET = 'whsec_server_test';
let server: Server;
let baseUrl: string;
let previousWebhookSecret: string | undefined;
let previousDevToken: string | undefined;
let previousDevPersonalId: string | undefined;

beforeAll(async () => {
  previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  previousDevToken = process.env.DEV_AUTH_TOKEN;
  previousDevPersonalId = process.env.DEV_PERSONAL_ID;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.DEV_AUTH_TOKEN;
  delete process.env.DEV_PERSONAL_ID;
  server = createApp().listen(0);
  await once(server, 'listening');

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (previousWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
  if (previousDevToken === undefined) delete process.env.DEV_AUTH_TOKEN;
  else process.env.DEV_AUTH_TOKEN = previousDevToken;
  if (previousDevPersonalId === undefined) delete process.env.DEV_PERSONAL_ID;
  else process.env.DEV_PERSONAL_ID = previousDevPersonalId;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('Express server middleware', () => {
  it('passes raw JSON bytes to the Stripe webhook handler', async () => {
    const body = Buffer.from('not-json');
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`), body]))
      .digest('hex');

    const response = await fetch(`${baseUrl}/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${timestamp},v1=${signature}`,
      },
      body,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Evento Stripe inválido' });
  });

  it('mounts the dashboard router and fails closed when development auth is not configured', async () => {
    const response = await fetch(`${baseUrl}/api/dashboard/executive`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Envie Authorization: Bearer <access_token>',
    });

  });

  it('does not expose dashboard routes to authenticated students', async () => {
      const app = createApp((req, _res, next) => {
        req.auth = {
          userId: 'student-user',
          subject: 'student-sub',
          role: 'STUDENT',
          tenantId: 'tenant-1',
          personalId: 'tenant-1',
          studentId: 'student-1',
        };
        req.tenantId = 'tenant-1';
        next();
      });
      const studentServer = app.listen(0);
      await once(studentServer, 'listening');
      const address = studentServer.address();
      if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta TCP');

      try {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/executive`);
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({
          error: 'Acesso restrito a personal autenticado',
        });
      } finally {
        await new Promise<void>((resolve, reject) => {
          studentServer.close((error) => (error ? reject(error) : resolve()));
        });
      }
  });

  it('uses express.json for non-webhook routes and reports malformed JSON cleanly', async () => {
    const response = await fetch(`${baseUrl}/api/unknown`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Pedido inválido',
      code: 'BAD_REQUEST',
    });
  });

  it('reports a missing Stripe webhook secret clearly', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const response = await fetch(`${baseUrl}/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'STRIPE_WEBHOOK_SECRET não configurado',
    });
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('rejects a malformed Stripe webhook secret configuration without disclosing it', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'not-a-stripe-secret';
    const response = await fetch(`${baseUrl}/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'STRIPE_WEBHOOK_SECRET inválido; configure o segredo whsec_ do endpoint Stripe',
    });
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });
});
